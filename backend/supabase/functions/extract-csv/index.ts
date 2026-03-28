/**
 * extract-csv — Supabase Edge Function
 *
 * Parses CSV measurement exports and inserts them into the measurements table.
 * Triggered by: pg_cron when a processing_jobs row has status='queued'
 * and job_type='extract-csv'.
 *
 * Expected in processing_jobs.input_data:
 *   { storage_path: string, room_id: string, file_name: string }
 *
 * POST /
 * Body: { job_id: string }
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

function normalizeHeader(header: string): string {
  const h = header.toLowerCase().trim().replace(/['"]/g, "");
  if (["label", "name", "element", "description", "element_type"].some((k) => h.includes(k))) return "label";
  if (["type", "category", "element"].some((k) => h.includes(k))) return "type";
  if (["length", "width", "wall_length"].some((k) => h.includes(k)) && !h.includes("height")) return "length";
  if (["height", "wall_height", "ceiling_height"].some((k) => h.includes(k))) return "height";
  if (["area", "sqft", "wall_area"].some((k) => h.includes(k))) return "area";
  if (["material", "notes", "description"].some((k) => h.includes(k))) return "notes";
  return "unknown";
}

function parseCSVContent(content: string): { rows: CSVRow[] } {
  const lines = content.trim().split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rows: [] };

  const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/['"]/g, ""));
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

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
      if (cols[idx]?.trim()) return cols[idx].trim();
    }
    return null;
  };

  const parseNum = (val: string | null): number | null => {
    if (!val) return null;
    const n = parseFloat(val.replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? null : n;
  };

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/['"]/g, ""));
    const rawType = getValue(typeIndices, cols)?.toLowerCase() || "wall";
    const type: CSVRow["type"] = rawType.includes("door")
      ? "door"
      : rawType.includes("window")
      ? "window"
      : rawType.includes("ceiling")
      ? "ceiling"
      : rawType.includes("floor")
      ? "floor"
      : "wall";

    const length_ft = parseNum(getValue(lengthIndices, cols));
    const height_ft = parseNum(getValue(heightIndices, cols));
    let area_sqft = parseNum(getValue(areaIndices, cols));
    if (!area_sqft && length_ft && height_ft) area_sqft = length_ft * height_ft;

    const label = getValue(labelIndices, cols) || `Element ${i}`;
    const notes = getValue(notesIndices, cols);

    rows.push({ label, type, length_ft, height_ft, area_sqft, confidence: 0.95, notes });
  }

  return { rows };
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

    // Mark job + file as processing
    await supabase.from("processing_jobs").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", job_id);
    await supabase.from("project_files").update({ processing_status: "processing" }).eq("id", job.project_file_id);

    // Download CSV
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`STORAGE_DOWNLOAD_FAILED: ${downloadError?.message}`);
    }

    const csvText = await (fileData as Blob).text();
    const { rows } = parseCSVContent(csvText);

    if (rows.length === 0) {
      await supabase.from("processing_jobs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: "CSV empty or unparseable" }).eq("id", job_id);
      await supabase.from("project_files").update({ processing_status: "failed" }).eq("id", job.project_file_id);
      return new Response(JSON.stringify({ error: "NO_MEASUREMENTS_FOUND", message: "CSV has no parseable data" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert measurements — only use columns that exist in the schema
    if (roomId) {
      const measurementRecords = rows.map((row) => ({
        room_id: roomId,
        category: row.type === "wall" ? "wall" : row.type === "door" || row.type === "window" ? "trim" : "misc",
        measurement_type: row.area_sqft ? "square_foot" : "linear_foot",
        label: row.label,
        value: row.area_sqft || row.length_ft || 0,
        unit: row.area_sqft ? "sqft" : "lf",
        source: "csv_import",
        confidence_score: row.confidence,
        notes: row.notes,
      }));

      const { error: insertError } = await supabase.from("measurements").insert(measurementRecords);
      if (insertError) throw new Error(`DB_INSERT_FAILED: ${insertError.message}`);
    }

    // Mark completed
    await supabase.from("processing_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      output_data: { rows_imported: rows.length },
    }).eq("id", job_id);

    await supabase.from("project_files").update({ processing_status: "completed" }).eq("id", job.project_file_id);

    return new Response(JSON.stringify({
      success: true, job_id, measurements_count: rows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in extract-csv:", message);

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
