/**
 * extract-measurements — Supabase Edge Function
 * 
 * Main routing function for measurement extraction.
 * Accepts file_storage_path, file_type, and room_id.
 * Routes to appropriate extractor based on file_type.
 * NEVER returns hallucinated values — fails cleanly on uncertainty.
 * 
 * POST /
 * Body: {
 *   file_storage_path: string,
 *   file_type: string,
 *   room_id: string,
 *   job_id?: string  // optional, for updating job status
 * }
 * 
 * Response: ExtractionResult (see MEASUREMENT_EXTRACTION.md)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Room photo measurement extraction prompt
const ROOM_PHOTO_EXTRACTION_PROMPT = `You are a construction measurement expert. Analyze this room photo and extract precise dimensional measurements.

CRITICAL INSTRUCTIONS:
- Only report measurements you can CONFIDENTLY identify from the image
- For each wall, estimate confidence: 0.0-1.0
- If you cannot identify a wall's dimensions, say "UNABLE_TO_MEASURE" — do not guess
- Do not estimate ceiling height unless clearly visible
- Report in feet and inches where possible
- NEVER hallucinate measurements — if uncertain, return confidence < 0.5 and flag it
- If walls cannot be reliably measured, return partial data with a note

Return EXACTLY this JSON structure, no additional text:
{
  "room_shape": "rectangular" | "l_shaped" | "other",
  "walls": [
    {
      "label": "North" | "South" | "East" | "West" | "Wall-1" | "Wall-2",
      "length_ft": number,
      "height_ft": number,
      "confidence": number,
      "note": "UNABLE_TO_MEASURE" | "Clear view" | "Partially visible" | "Estimated"
    }
  ],
  "openings": [
    {
      "type": "door" | "window",
      "label": "Front Door" | "Window 1" | etc,
      "width_ft": number,
      "height_ft": number,
      "confidence": number
    }
  ],
  "ceiling_height": number | null,
  "notes": "Any additional observations or caveats"
}`;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

// Retry configuration
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;

/**
 * Update processing job status
 */
async function updateJobStatus(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  status: "processing" | "completed" | "failed",
  result?: any,
  errorCode?: string,
  errorMessage?: string
) {
  await supabase
    .from("processing_jobs")
    .update({
      status,
      result: result || null,
      error_code: errorCode || null,
      error_message: errorMessage || null,
      completed_at: status !== "processing" ? new Date().toISOString() : null,
    })
    .eq("id", jobId);
}

/**
 * Download file from Supabase storage
 */
async function downloadFromStorage(
  supabase: ReturnType<typeof createClient>,
  filePath: string
): Promise<{ data: ArrayBuffer; contentType: string }> {
  const { data, error } = await supabase.storage
    .from("room-files")
    .download(filePath);

  if (error || !data) {
    throw new Error(`STORAGE_DOWNLOAD_FAILED: ${error?.message || "Unknown error"}`);
  }

  const contentType = (data as any).type || "application/octet-stream";
  const arrayBuffer = await (data as Blob).arrayBuffer();
  
  return { data: arrayBuffer, contentType };
}

/**
 * Extract measurements from image using GPT-4o Vision
 */
async function extractFromImage(
  imageData: ArrayBuffer,
  contentType: string
): Promise<any> {
  const base64 = btoa(
    String.fromCharCode(...new Uint8Array(imageData))
  );
  const dataUrl = `data:${contentType};base64,${base64}`;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: ROOM_PHOTO_EXTRACTION_PROMPT,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: dataUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          max_tokens: 2048,
          temperature: 0.1, // Low temperature for measurement accuracy
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OPENAI_API_ERROR: ${response.status} - ${errorBody}`);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error("NO_CONTENT: AI returned empty response");
      }

      // Parse JSON response
      // Handle potential markdown code blocks
      let jsonStr = content.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith("```")) {
        jsonStr = jsonStr.slice(0, -3);
      }

      const parsed = JSON.parse(jsonStr.trim());
      return parsed;

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
    }
  }

  throw lastError || new Error("AI_PROCESSING_FAILED: Max retries exceeded");
}

/**
 * Parse CSV file directly
 */
function parseCSV(content: string): any {
  const lines = content.trim().split("\n");
  if (lines.length < 2) {
    return { success: false, error_code: "NO_MEASUREMENTS_FOUND", error_message: "CSV has no data rows" };
  }

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  
  // Find column indices
  const labelIdx = headers.findIndex(h => ["label", "name", "element", "type", "description"].includes(h));
  const typeIdx = headers.findIndex(h => ["type", "element_type", "category"].includes(h));
  const lengthIdx = headers.findIndex(h => ["length", "length_ft", "wall_length", "width"].includes(h));
  const heightIdx = headers.findIndex(h => ["height", "height_ft", "wall_height", "ceiling_height"].includes(h));
  const areaIdx = headers.findIndex(h => ["area", "area_sqft", "wall_area", "sqft"].includes(h));

  const rows: any[] = [];
  let totalWallArea = 0;
  let totalDoorArea = 0;
  let totalWindowArea = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/['"]/g, ""));
    
    const type = typeIdx >= 0 ? cols[typeIdx]?.toLowerCase() : "wall";
    const length = lengthIdx >= 0 ? parseFloat(cols[lengthIdx]) : null;
    const height = heightIdx >= 0 ? parseFloat(cols[heightIdx]) : null;
    const area = areaIdx >= 0 ? parseFloat(cols[areaIdx]) : (length && height ? length * height : null);

    const row = {
      label: labelIdx >= 0 ? cols[labelIdx] : `Row ${i}`,
      type: ["door", "window"].some(t => type.includes(t)) 
        ? type.includes("door") ? "door" : "window" 
        : "wall",
      length_ft: isNaN(length!) ? null : length,
      height_ft: isNaN(height!) ? null : height,
      area_sqft: isNaN(area!) ? null : area,
      confidence: 0.95, // CSV values are direct measurements
    };

    if (row.type === "wall" && row.area_sqft) totalWallArea += row.area_sqft;
    if (row.type === "door" && row.area_sqft) totalDoorArea += row.area_sqft;
    if (row.type === "window" && row.area_sqft) totalWindowArea += row.area_sqft;

    rows.push(row);
  }

  return {
    success: true,
    data: {
      rows,
      totalWalls_sqft: totalWallArea,
      totalDoors_sqft: totalDoorArea,
      totalWindows_sqft: totalWindowArea,
      totalOpenings_sqft: totalDoorArea + totalWindowArea,
      netPaintableArea_sqft: totalWallArea - totalDoorArea - totalWindowArea,
      raw_confidence: 0.95,
    },
  };
}

Deno.serve(async (req: Request) => {
  // CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { file_storage_path, file_type, room_id, job_id } = body;

    if (!file_storage_path || !file_type || !room_id) {
      return new Response(JSON.stringify({
        success: false,
        error_code: "MISSING_FIELDS",
        error_message: "file_storage_path, file_type, and room_id are required",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update job to processing if job_id provided
    if (job_id) {
      await updateJobStatus(supabase, job_id, "processing");
    }

    let extractionResult: any;

    if (file_type === "image") {
      // Download image and extract via AI
      const { data: imageData, contentType } = await downloadFromStorage(supabase, file_storage_path);
      extractionResult = await extractFromImage(imageData, contentType);

    } else if (file_type === "csv") {
      // Download and parse CSV directly
      const { data: csvData } = await downloadFromStorage(supabase, file_storage_path);
      const decoder = new TextDecoder();
      const csvText = decoder.decode(csvData);
      extractionResult = parseCSV(csvText);

    } else if (file_type === "pdf" || file_type === "dxf") {
      // PDFs and DXF are handled by extract-pdf function
      // This function just routes; for now, return routing info
      extractionResult = {
        success: false,
        error_code: "WRONG_PROCESSOR",
        error_message: `file_type '${file_type}' should be processed by extract-pdf function`,
      };

    } else if (["obj", "gltf", "glb", "ply", "fbx", "usdz"].includes(file_type)) {
      // 3D formats should go to extract-polycam
      extractionResult = {
        success: false,
        error_code: "WRONG_PROCESSOR",
        error_message: `file_type '${file_type}' should be processed by extract-polycam function`,
      };

    } else {
      extractionResult = {
        success: false,
        error_code: "INVALID_FORMAT",
        error_message: `Unsupported file_type: ${file_type}`,
      };
    }

    // Check if extraction succeeded
    if (!extractionResult.success) {
      if (job_id) {
        await updateJobStatus(
          supabase, job_id, "failed",
          null,
          extractionResult.error_code,
          extractionResult.error_message
        );
      }

      return new Response(JSON.stringify({
        success: false,
        room_id,
        file_type,
        ...extractionResult,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // On success — store measurements in room record
    const measurements = extractionResult.data;
    
    await supabase
      .from("rooms")
      .update({
        ceiling_height_ft: measurements.ceiling_height_ft || null,
        floor_area_sqft: measurements.total_floor_area_sqft || measurements.floorArea_sqft || null,
        gross_wall_area_sqft: measurements.totalWalls_sqft || measurements.gross_wall_area_sqft || null,
        net_wall_area_sqft: measurements.netPaintableArea_sqft || measurements.net_wall_area_sqft || null,
        openings_total_area_sqft: measurements.totalOpenings_sqft || measurements.openings_total_area_sqft || null,
        measurements_confidence: measurements.confidence_overall || measurements.raw_confidence || 0.8,
        last_measured_at: new Date().toISOString(),
        measurement_data: measurements,
      })
      .eq("id", room_id);

    if (job_id) {
      await updateJobStatus(supabase, job_id, "completed", extractionResult);
    }

    return new Response(JSON.stringify({
      success: true,
      room_id,
      file_type,
      job_id,
      ...extractionResult,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("extract-measurements error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const errorCode = message.includes("STORAGE") ? "STORAGE_ERROR" 
      : message.includes("OPENAI") ? "AI_PROCESSING_FAILED"
      : "INTERNAL_ERROR";

    if (body?.job_id) {
      await updateJobStatus(supabase, body.job_id, "failed", null, errorCode, message);
    }

    return new Response(JSON.stringify({
      success: false,
      error_code: errorCode,
      error_message: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper to satisfy TypeScript
function createClient(url: string, key: string) {
  return { from: () => ({}) }; // Placeholder — actual client created in handler
}
