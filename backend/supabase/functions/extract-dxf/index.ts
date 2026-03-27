/**
 * extract-dxf — Supabase Edge Function
 * 
 * Handles DXF (CAD) files with limited support.
 * DXF is a CAD format - full parsing requires complex geometry extraction.
 * This handler attempts basic text extraction for dimension values.
 * 
 * POST /
 * Body: {
 *   projectFileId: string,
 *   roomId?: string,
 *   storagePath: string
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Attempt to extract dimension values from DXF text content.
 * DXF files have sections like ENTITIES, DIMENSIONS, etc.
 * This is a best-effort extraction - full CAD parsing would require
 * a proper DXF parser library.
 */
function extractDimensionsFromDXF(content: string): {
  dimensions: Array<{ type: string; value: number; unit: string; label: string }>;
  notes: string[];
} {
  const dimensions: Array<{ type: string; value: number; unit: string; label: string }> = [];
  const notes: string[] = [];

  // Look for common dimension patterns in DXF text
  // DXF often stores dimension text as MTEXT or TEXT entities
  
  // Pattern 1: Look for dimension value patterns like "10'-6"" or "10'6"" or "126""
  const feetInchPattern = /(\d+)'\s*(\d+)["'']/g;
  // Pattern 2: Look for decimal feet like "10.5'" or "10.5 ft"
  const decimalFeetPattern = /(\d+\.?\d*)\s*(?:ft|')/gi;
  // Pattern 3: Look for inches only like "126"" or "126in"
  const inchesPattern = /(\d+\.?\d*)\s*(?:"|in|inch)/gi;
  // Pattern 4: Look for dimension block references
  const dimBlockPattern = /DIMENSION.*?X\s*=\s*([\d.]+).*?Y\s*=\s*([\d.]+)/gi;

  let match;
  const foundValues = new Set<string>();

  while ((match = feetInchPattern.exec(content)) !== null) {
    const feet = parseInt(match[1]);
    const inches = parseInt(match[2]);
    const totalInches = feet * 12 + inches;
    const totalFeet = totalInches / 12;
    const key = totalFeet.toFixed(2);
    if (!foundValues.has(key)) {
      foundValues.add(key);
      dimensions.push({
        type: "linear_foot",
        value: parseFloat(key),
        unit: "lf",
        label: `Wall Dimension (${match[0]})`,
      });
    }
  }

  while ((match = decimalFeetPattern.exec(content)) !== null) {
    const value = parseFloat(match[1]);
    const key = value.toFixed(2);
    if (!foundValues.has(key) && value > 0 && value < 1000) { // Sanity check
      foundValues.add(key);
      dimensions.push({
        type: "linear_foot",
        value,
        unit: "lf",
        label: `Dimension (${match[0]})`,
      });
    }
  }

  while ((match = inchesPattern.exec(content)) !== null) {
    const inches = parseFloat(match[1]);
    const feet = inches / 12;
    const key = feet.toFixed(2);
    if (!foundValues.has(key) && inches > 0 && inches < 1200) { // Sanity check: < 100ft
      foundValues.add(key);
      dimensions.push({
        type: "linear_foot",
        value,
        unit: "lf",
        label: `Dimension (${match[0]} = ${feet.toFixed(2)} ft)`,
      });
    }
  }

  if (foundValues.size === 0) {
    notes.push("DXF parsing: No dimension values found in text extraction. DXF files may require specialized CAD parsing for accurate measurement extraction.");
  }

  return { dimensions, notes };
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

    if (!projectFileId || !storagePath) {
      return new Response(JSON.stringify({
        success: false,
        error: "MISSING_FIELDS",
        message: "projectFileId and storagePath are required"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get project file info
    const { data: projectFile, error: fileError } = await supabase
      .from("project_files")
      .select("processing_job_id, organization_id, file_name")
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

    // Update job to processing
    if (jobId) {
      await supabase
        .from("processing_jobs")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", jobId);
    }

    // Download DXF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`STORAGE_DOWNLOAD_FAILED: ${downloadError?.message}`);
    }

    // Try to read as text (DXF can be ASCII or binary - try text first)
    let content: string;
    try {
      content = await (fileData as Blob).text();
    } catch {
      // Binary DXF - can't extract text dimensions
      if (jobId) {
        await supabase
          .from("processing_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: "DXF file appears to be in binary format. ASCII DXF format required for text extraction.",
          })
          .eq("id", jobId);
      }

      return new Response(JSON.stringify({
        success: false,
        status: "failed",
        error: "BINARY_FORMAT_UNSUPPORTED",
        message: "DXF parsing not fully supported. Only ASCII DXF format can be partially parsed for dimension values.",
        file_name: projectFile.file_name,
        note: "For full CAD measurement extraction, consider exporting to PDF or using specialized DXF parsing software.",
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Attempt dimension extraction
    const { dimensions, notes } = extractDimensionsFromDXF(content);

    if (dimensions.length === 0) {
      // No extractable dimensions
      if (jobId) {
        await supabase
          .from("processing_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: "No dimension values could be extracted from DXF file",
          })
          .eq("id", jobId);
      }

      return new Response(JSON.stringify({
        success: false,
        status: "failed",
        error: "NO_DIMENSIONS_FOUND",
        message: "DXF parsing not fully supported. Could not extract dimension values from this file.",
        notes,
        file_name: projectFile.file_name,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert what we found as measurements
    if (roomId && dimensions.length > 0) {
      const measurementRecords = dimensions.map(dim => ({
        room_id: roomId,
        organization_id: projectFile.organization_id,
        category: "wall",
        measurement_type: dim.type,
        label: dim.label,
        value: dim.value,
        unit: dim.unit,
        source: "dxf_extracted" as const,
        confidence_score: 0.6, // DXF extraction has lower confidence
        notes: notes.join(" "),
      }));

      await supabase.from("measurements").insert(measurementRecords);
    }

    // Update job as completed with partial success
    if (jobId) {
      await supabase
        .from("processing_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          output_data: {
            dimensions_found: dimensions.length,
            partial_extraction: true,
            notes,
          },
        })
        .eq("id", jobId);
    }

    // Update project file
    await supabase
      .from("project_files")
      .update({ processing_status: "completed" })
      .eq("id", projectFileId);

    return new Response(JSON.stringify({
      success: true,
      status: "completed",
      projectFileId,
      roomId: roomId || null,
      jobId,
      note: "DXF extraction is limited - results may be partial",
      dimensions_found: dimensions.length,
      dimensions,
      notes,
      confidence: 0.6,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in extract-dxf:", error);

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
              error_message: error instanceof Error ? error.message : "Unknown error",
            })
            .eq("id", projectFile.processing_job_id);
        }

        await supabase
          .from("project_files")
          .update({
            processing_status: "failed",
            processing_error: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", projectFileId);
      }
    } catch (_) {
      // Ignore cleanup errors
    }

    return new Response(JSON.stringify({
      success: false,
      status: "failed",
      error: "EXTRACTION_FAILED",
      message: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
