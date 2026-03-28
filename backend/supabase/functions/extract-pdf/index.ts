/**
 * extract-pdf — Supabase Edge Function
 *
 * Parses PDF files, extracts room measurements using OpenAI GPT-4o vision,
 * and inserts them into the measurements table.
 *
 * Triggered by: pg_cron when a processing_jobs row has status='queued'
 * and job_type='extract-pdf'.
 *
 * POST /
 * Body: { job_id: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Measurement {
  category: string;
  measurement_type: string;
  label: string;
  value: number;
  unit: string;
  confidence_score?: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get job details
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

    // Mark job + file as processing
    await supabase
      .from("processing_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", job_id);

    await supabase
      .from("project_files")
      .update({ processing_status: "processing" })
      .eq("id", job.project_file_id);

    // Read context from input_data (set by process-file)
    const inputData = job.input_data as Record<string, string | null>;
    const storagePath = inputData.storage_path as string;
    const roomId = inputData.room_id as string | null;

    if (!storagePath) {
      throw new Error("No storage_path in job input_data");
    }

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`);
    }

    // Get file size
    const fileSize = fileData.size;

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Extract measurements using OpenAI
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a construction measurement extraction specialist for drywall and paint estimation.

From the PDF content, extract ALL measurements useful for a drywall/paint contractor:
- Wall square footage (per wall and total)
- Ceiling square footage
- Floor square footage
- Linear footage of trim (baseboard, crown, door casing)
- Door and window opening dimensions (for deduction)
- Any other relevant dimensions

Return a JSON object:
{
  "measurements": [
    {
      "category": "wall|ceiling|floor|trim|opening|misc",
      "measurement_type": "square_foot|linear_foot|unit|each",
      "label": "Descriptive label (e.g., 'North Wall', 'Kitchen Ceiling', 'Door 1')",
      "value": number,
      "unit": "sqft|lf|ea",
      "confidence_score": 0.0-1.0
    }
  ],
  "summary": "Brief summary of what was found"
}`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all room measurements and dimensions from this PDF. Include wall areas, ceiling, floor, trim lengths, and opening dimensions. Be thorough — list every measurement you can find.`,
              },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${base64Pdf}` },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2048,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const openaiData = await openaiResponse.json();
    const rawContent = openaiData.choices?.[0]?.message?.content;

    let extractedData = { measurements: [] as Measurement[], summary: "" };
    if (rawContent) {
      try {
        extractedData = JSON.parse(rawContent);
      } catch {
        console.error("Failed to parse OpenAI response:", rawContent);
      }
    }

    // Insert measurements
    if (roomId && extractedData.measurements.length > 0) {
      const measurementRecords = extractedData.measurements.map((m) => ({
        room_id: roomId,
        category: m.category,
        measurement_type: m.measurement_type,
        label: m.label,
        value: m.value,
        unit: m.unit,
        source: "ai_extracted",
        confidence_score: m.confidence_score || null,
        notes: null,
      }));

      const { error: measurementError } = await supabase
        .from("measurements")
        .insert(measurementRecords);

      if (measurementError) {
        console.error("Error inserting measurements:", measurementError);
      }
    }

    // Mark job completed
    await supabase
      .from("processing_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output_data: {
          measurements_count: extractedData.measurements.length,
          summary: extractedData.summary,
        },
      })
      .eq("id", job_id);

    // Update project file — correct status + file_size
    await supabase
      .from("project_files")
      .update({ processing_status: "completed", file_size: fileSize })
      .eq("id", job.project_file_id);

    return new Response(
      JSON.stringify({
        success: true,
        job_id,
        measurements_count: extractedData.measurements.length,
        summary: extractedData.summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in extract-pdf:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { job_id } = await req.json().catch(() => ({}));

      if (job_id) {
        const { data: job } = await supabase
          .from("processing_jobs")
          .select("project_file_id")
          .eq("id", job_id)
          .single();

        await supabase
          .from("processing_jobs")
          .update({ status: "failed", error_message: message })
          .eq("id", job_id);

        await supabase
          .from("project_files")
          .update({ processing_status: "failed", processing_error: message })
          .eq("id", job?.project_file_id);
      }
    } catch (_) {
      // ignore cleanup errors
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
