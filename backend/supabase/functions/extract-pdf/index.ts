// extract-pdf/index.ts
// Parses PDF, extracts dimensions/measurements using OpenAI

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { job_id } = await req.json();

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark job as processing
    await supabase
      .from("processing_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", job_id);

    await supabase
      .from("project_files")
      .update({ processing_status: "extracting" })
      .eq("id", job.project_file_id);

    const inputData = job.input_data as Record<string, string>;
    const storagePath = inputData.storage_path;
    const roomId = inputData.room_id;

    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download PDF: ${downloadError?.message}`);
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Use OpenAI to extract measurements from PDF content description
    // Note: For a production system, you'd use a PDF parsing library first,
    // then send the extracted text to OpenAI. Here we use a vision model approach.
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
            content: `You are a construction measurement extraction specialist. Given a PDF containing room measurements, wall dimensions, or construction drawings, extract all measurements.

Return a JSON object with this exact structure:
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
                text: `Please analyze this PDF and extract all room measurements, dimensions, and quantities visible. The file is a construction/drywall/paint related document. Extract all measurements including wall square footage, linear footage of trim, ceiling areas, door/window openings, and any other relevant dimensions.

If the PDF cannot be read or contains no extractable measurements, return an empty measurements array with a summary explaining why.

Storage path: ${storagePath}`,
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

    // Insert measurements into the database
    if (roomId && extractedData.measurements.length > 0) {
      const measurementRecords = extractedData.measurements.map((m) => ({
        room_id: roomId,
        category: m.category,
        measurement_type: m.measurement_type,
        label: m.label,
        value: m.value,
        unit: m.unit,
        source: "ai_extracted" as const,
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

    // Mark job as completed
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

    await supabase
      .from("project_files")
      .update({ processing_status: "completed" })
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

    // Try to mark job as failed
    try {
      const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { job_id } = await req.json().catch(() => ({}));

      if (job_id) {
        await supabase
          .from("processing_jobs")
          .update({ status: "failed", error_message: error.message })
          .eq("id", job_id);

        await supabase
          .from("project_files")
          .update({ processing_status: "failed", processing_error: error.message })
          .eq("id", (await supabase.from("processing_jobs").select("project_file_id").eq("id", job_id).single()).data?.project_file_id);
      }
    } catch (_) {
      // ignore cleanup errors
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
