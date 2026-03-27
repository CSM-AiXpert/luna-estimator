/**
 * extract-csv — Supabase Edge Function
 * 
 * Parses CSV measurement exports and maps rows to the measurements table.
 * Supports columns like 'room', 'width', 'length', 'height', 'area', 'description', 'material'.
 * 
 * POST /
 * Body: {
 *   projectFileId: string,
 *   roomId: string,
 *   storagePath: string
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CSVRow {
  label: string;
  type: "wall" | "door" | "window" | "ceiling" | "floor" | "unknown";
  length_ft: number | null;
  height_ft: number | null;
  area_sqft: number | null;
  confidence: number;
  notes: string | null;
}

/**
 * Normalize column header names to standard keys
 */
function normalizeHeader(header: string): string {
  const h = header.toLowerCase().trim().replace(/['"]/g, "");
  
  if (["label", "name", "element", "description", "element_type"].some(k => h.includes(k))) {
    return "label";
  }
  if (["type", "category", "element"].some(k => h.includes(k))) {
    return "type";
  }
  if (["length", "width", "wall_length"].some(k => h.includes(k)) && !h.includes("height")) {
    return "length";
  }
  if (["height", "wall_height", "ceiling_height"].some(k => h.includes(k))) {
    return "height";
  }
  if (["area", "sqft", "wall_area"].some(k => h.includes(k))) {
    return "area";
  }
  if (["material", "notes", "description"].some(k => h.includes(k))) {
    return "notes";
  }
  
  return "unknown";
}

/**
 * Parse CSV content into structured rows
 */
function parseCSVContent(content: string): { rows: CSVRow[]; totalWallArea: number; totalDoorArea: number; totalWindowArea: number } {
  const lines = content.trim().split("\n").filter(line => line.trim().length > 0);
  
  if (lines.length < 2) {
    return { rows: [], totalWallArea: 0, totalDoorArea: 0, totalWindowArea: 0 };
  }

  // Parse headers
  const headerLine = lines[0];
  const rawHeaders = headerLine.split(",").map(h => h.trim().replace(/['"]/g, ""));
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  
  // Find column indices for each normalized type
  const getIndices = (type: string): number[] => 
    normalizedHeaders.reduce((acc: number[], h, i) => {
      if (h === type) acc.push(i);
      return acc;
    }, []);
  
  const labelIndices = getIndices("label");
  const typeIndices = getIndices("type");
  const lengthIndices = getIndices("length");
  const heightIndices = getIndices("height");
  const areaIndices = getIndices("area");
  const notesIndices = getIndices("notes");

  const getValue = (indices: number[], cols: string[]): string | null => {
    for (const idx of indices) {
      if (cols[idx] && cols[idx].trim()) return cols[idx].trim();
    }
    return null;
  };

  const parseNum = (val: string | null): number | null => {
    if (!val) return null;
    const n = parseFloat(val.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? null : n;
  };

  const rows: CSVRow[] = [];
  let totalWallArea = 0;
  let totalDoorArea = 0;
  let totalWindowArea = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/['"]/g, ""));
    
    const rawType = getValue(typeIndices, cols)?.toLowerCase() || "wall";
    const type: CSVRow["type"] = rawType.includes("door") ? "door" 
      : rawType.includes("window") ? "window"
      : rawType.includes("ceiling") ? "ceiling"
      : rawType.includes("floor") ? "floor"
      : "wall";

    const length_ft = parseNum(getValue(lengthIndices, cols));
    const height_ft = parseNum(getValue(heightIndices, cols));
    
    // Calculate area if not directly provided
    let area_sqft = parseNum(getValue(areaIndices, cols));
    if (!area_sqft && length_ft && height_ft) {
      area_sqft = length_ft * height_ft;
    }

    const label = getValue(labelIndices, cols) || `Element ${i}`;
    const notes = getValue(notesIndices, cols);

    const row: CSVRow = {
      label,
      type,
      length_ft,
      height_ft,
      area_sqft,
      confidence: 0.95, // CSV values are direct measurements, high confidence
      notes,
    };

    rows.push(row);

    // Accumulate totals
    if (area_sqft) {
      if (type === "wall") totalWallArea += area_sqft;
      else if (type === "door") totalDoorArea += area_sqft;
      else if (type === "window") totalWindowArea += area_sqft;
    }
  }

  return { rows, totalWallArea, totalDoorArea, totalWindowArea };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { projectFileId, roomId, storagePath } = await req.json();

    if (!projectFileId || !roomId || !storagePath) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "MISSING_FIELDS",
        message: "projectFileId, roomId, and storagePath are required"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get job from project_files
    const { data: projectFile, error: fileError } = await supabase
      .from("project_files")
      .select("processing_job_id, organization_id")
      .eq("id", projectFileId)
      .single();

    if (fileError || !projectFile) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "FILE_NOT_FOUND",
        message: "Project file not found"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobId = projectFile.processing_job_id;

    // Update job status to processing
    if (jobId) {
      await supabase
        .from("processing_jobs")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", jobId);
    }

    // Download CSV from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`STORAGE_DOWNLOAD_FAILED: ${downloadError?.message}`);
    }

    // Parse CSV content
    const csvText = await (fileData as Blob).text();
    const { rows, totalWallArea, totalDoorArea, totalWindowArea } = parseCSVContent(csvText);

    if (rows.length === 0) {
      // Update job as failed
      if (jobId) {
        await supabase
          .from("processing_jobs")
          .update({ 
            status: "failed", 
            completed_at: new Date().toISOString(),
            error_message: "CSV file is empty or has no data rows"
          })
          .eq("id", jobId);
      }

      return new Response(JSON.stringify({
        success: false,
        error: "NO_MEASUREMENTS_FOUND",
        message: "CSV file contains no parseable measurement data"
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert measurement records
    const measurementRecords = rows.map(row => ({
      room_id: roomId,
      organization_id: projectFile.organization_id,
      category: row.type === "wall" ? "wall" : row.type === "door" ? "trim" : row.type === "window" ? "trim" : "misc",
      measurement_type: row.area_sqft ? "square_foot" : "linear_foot",
      label: row.label,
      value: row.area_sqft || row.length_ft || 0,
      unit: row.area_sqft ? "sqft" : "lf",
      source: "csv_import" as const,
      confidence_score: row.confidence,
      notes: row.notes,
    }));

    const { error: insertError } = await supabase
      .from("measurements")
      .insert(measurementRecords);

    if (insertError) {
      console.error("Error inserting CSV measurements:", insertError);
      throw new Error(`DB_INSERT_FAILED: ${insertError.message}`);
    }

    // Update room with aggregated values
    await supabase
      .from("rooms")
      .update({
        gross_wall_area_sqft: totalWallArea,
        net_wall_area_sqft: totalWallArea - totalDoorArea - totalWindowArea,
        openings_total_area_sqft: totalDoorArea + totalWindowArea,
        measurements_confidence: 0.95,
        last_measured_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    // Update job as completed
    if (jobId) {
      await supabase
        .from("processing_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: {
            rows_imported: rows.length,
            total_wall_area_sqft: totalWallArea,
            total_door_area_sqft: totalDoorArea,
            total_window_area_sqft: totalWindowArea,
          },
        })
        .eq("id", jobId);
    }

    // Update project file status
    await supabase
      .from("project_files")
      .update({ processing_status: "completed" })
      .eq("id", projectFileId);

    return new Response(JSON.stringify({
      success: true,
      projectFileId,
      roomId,
      jobId,
      measurements: {
        rows_imported: rows.length,
        total_wall_area_sqft: totalWallArea,
        total_door_area_sqft: totalDoorArea,
        total_window_area_sqft: totalWindowArea,
        net_wall_area_sqft: totalWallArea - totalDoorArea - totalWindowArea,
      },
      raw_rows: rows,
      confidence: 0.95,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in extract-csv:", error);

    // Try to update job status on failure
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { projectFileId } = await req.json().catch(() => ({}));
      
      if (projectFileId) {
        const { data: projectFile } = await supabase
          .from("project_files")
          .select("processing_job_id")
          .eq("id", projectFileId)
          .single();

        if (projectFile?.processing_job_id) {
          await supabase
            .from("processing_jobs")
            .update({ 
              status: "failed", 
              completed_at: new Date().toISOString(),
              error_message: error instanceof Error ? error.message : "Unknown error"
            })
            .eq("id", projectFile.processing_job_id);
        }

        await supabase
          .from("project_files")
          .update({ 
            processing_status: "failed",
            processing_error: error instanceof Error ? error.message : "Unknown error"
          })
          .eq("id", projectFileId);
      }
    } catch (_) {
      // Ignore cleanup errors
    }

    return new Response(JSON.stringify({
      success: false,
      error: "EXTRACTION_FAILED",
      message: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
