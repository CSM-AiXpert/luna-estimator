/**
 * extract-dxf — Supabase Edge Function
 *
 * Handles DXF (CAD) files with best-effort text extraction for dimension values.
 * Triggered by: pg_cron when a processing_jobs row has status='queued'
 * and job_type='extract-dxf'.
 *
 * Expected in processing_jobs.input_data:
 *   { storage_path: string, room_id: string|null, file_name: string }
 *
 * POST /
 * Body: { job_id: string }
 *
 * NOTE: DXF support is limited to ASCII DXF format. Binary DXF files cannot
 * be parsed via text extraction and will be marked as failed.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractDimensionsFromDXF(content: string): {
  dimensions: Array<{ type: string; value: number; unit: string; label: string }>;
  notes: string[];
} {
  const dimensions: Array<{ type: string; value: number; unit: string; label: string }> = [];
  const notes: string[] = [];

  const feetInchPattern = /(\d+)'\s*(\d+)["'']/g;
  const decimalFeetPattern = /(\d+\.?\d*)\s*(?:ft|')/gi;
  const inchesPattern = /(\d+\.?\d*)\s*(?:"|in|inch)/gi;

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
      dimensions.push({ type: "linear_foot", value: parseFloat(key), unit: "lf", label: `Wall (${match[0]})` });
    }
  }

  while ((match = decimalFeetPattern.exec(content)) !== null) {
    const value = parseFloat(match[1]);
    const key = value.toFixed(2);
    if (!foundValues.has(key) && value > 0 && value < 1000) {
      foundValues.add(key);
      dimensions.push({ type: "linear_foot", value, unit: "lf", label: `Dimension (${match[0]})` });
    }
  }

  while ((match = inchesPattern.exec(content)) !== null) {
    const inches = parseFloat(match[1]);
    const feet = inches / 12;
    const key = feet.toFixed(2);
    if (!foundValues.has(key) && inches > 0 && inches < 1200) {
      foundValues.add(key);
      dimensions.push({ type: "linear_foot", value: feet, unit: "lf", label: `(${match[0]} = ${feet.toFixed(2)} ft)` });
    }
  }

  if (foundValues.size === 0) {
    notes.push("No dimension values found via text extraction. ASCII DXF required — binary DXF cannot be parsed this way.");
  }

  return { dimensions, notes };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get job — input_data has storage_path and room_id
    const { data: job, error: jobError } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.status !== "queued") {
      return new Response(JSON.stringify({ error: `Job already processed (status: ${job.status})` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inputData = job.input_data as Record<string, string | null>;
    const storagePath = inputData.storage_path as string;
    const roomId = inputData.room_id as string | null;

    if (!storagePath) {
      throw new Error("No storage_path in job input_data");
    }

    // Mark processing
    await supabase.from("processing_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job_id);
    await supabase.from("project_files").update({ processing_status: "processing" }).eq("id", job.project_file_id);

    // Download DXF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`STORAGE_DOWNLOAD_FAILED: ${downloadError?.message}`);
    }

    // Try text extraction
    let content: string;
    try {
      content = await (fileData as Blob).text();
    } catch {
      await supabase.from("processing_jobs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Binary DXF format — ASCII required for text extraction" }).eq("id", job_id);
      await supabase.from("project_files").update({ processing_status: "failed", processing_error: "Binary DXF unsupported" }).eq("id", job.project_file_id);
      return new Response(JSON.stringify({ error: "BINARY_FORMAT_UNSUPPORTED", message: "Binary DXF cannot be parsed. Export as ASCII DXF." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dimensions, notes } = extractDimensionsFromDXF(content);

    if (dimensions.length === 0) {
      await supabase.from("processing_jobs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: "No dimensions found in DXF" }).eq("id", job_id);
      await supabase.from("project_files").update({ processing_status: "failed" }).eq("id", job.project_file_id);
      return new Response(JSON.stringify({ error: "NO_DIMENSIONS_FOUND", notes }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert measurements — no organization_id (not in schema)
    if (roomId) {
      const measurementRecords = dimensions.map((dim) => ({
        room_id: roomId,
        category: "wall",
        measurement_type: dim.type,
        label: dim.label,
        value: dim.value,
        unit: dim.unit,
        source: "dxf_extracted",
        confidence_score: 0.6,
        notes: notes.join(" "),
      }));

      const { error: insertError } = await supabase.from("measurements").insert(measurementRecords);
      if (insertError) throw new Error(`DB_INSERT_FAILED: ${insertError.message}`);
    }

    // Mark completed
    await supabase.from("processing_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      output_data: { dimensions_found: dimensions.length, partial_extraction: true },
    }).eq("id", job_id);

    await supabase.from("project_files").update({ processing_status: "completed" }).eq("id", job.project_file_id);

    return new Response(JSON.stringify({
      success: true, job_id, dimensions_found: dimensions.length, notes,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in extract-dxf:", message);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { job_id } = await req.json().catch(() => ({}));
      if (job_id) {
        const { data: job } = await supabase.from("processing_jobs").select("project_file_id").eq("id", job_id).single();
        await supabase.from("processing_jobs").update({ status: "failed", error_message: message }).eq("id", job_id);
        await supabase.from("project_files").update({ processing_status: "failed", processing_error: message }).eq("id", job?.project_file_id);
      }
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
