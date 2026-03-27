// process-file/index.ts
// Accepts file upload, classifies type, creates processing_job, routes to correct extractor

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id, room_id, file_name, file_type, mime_type, file_size, storage_path, source } =
      await req.json();

    // Validate required fields
    if (!project_id || !storage_path || !file_name || !mime_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: project_id, storage_path, file_name, mime_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine job type based on mime type
    let jobType: string;
    if (mime_type === "application/pdf") {
      jobType = "pdf_extraction";
    } else if (
      mime_type === "model/gltf+json" ||
      mime_type === "model/gltf-binary" ||
      mime_type === "application/octet-stream" ||
      file_name.endsWith(".obj") ||
      file_name.endsWith(".glb") ||
      file_name.endsWith(".gltf") ||
      file_name.endsWith(".ply")
    ) {
      jobType = "polycam_parsing";
    } else if (mime_type.startsWith("image/")) {
      jobType = "ai_measurement";
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported file type: ${mime_type}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert project file record
    const { data: projectFile, error: fileError } = await supabase
      .from("project_files")
      .insert({
        project_id,
        room_id: room_id || null,
        storage_path,
        file_name,
        file_type,
        mime_type,
        file_size: file_size || 0,
        source: source || "upload",
        processing_status: "queued",
      })
      .select()
      .single();

    if (fileError) {
      console.error("Error creating project file:", fileError);
      return new Response(JSON.stringify({ error: fileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create processing job
    const { data: job, error: jobError } = await supabase
      .from("processing_jobs")
      .insert({
        project_file_id: projectFile.id,
        job_type: jobType,
        status: "pending",
        input_data: {
          storage_path,
          mime_type,
          file_name,
          project_id,
          room_id: room_id || null,
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error("Error creating processing job:", jobError);
      // Rollback project file
      await supabase.from("project_files").delete().eq("id", projectFile.id);
      return new Response(JSON.stringify({ error: jobError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update project file status
    await supabase
      .from("project_files")
      .update({ processing_status: "queued" })
      .eq("id", projectFile.id);

    // Route to the appropriate extractor based on job type
    const extractorUrl = `${supabaseUrl}/functions/v1/${jobType.replace("_", "-")}`;

    // Trigger the extractor (fire-and-forget, the extractor will poll the job)
    try {
      fetch(extractorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ job_id: job.id }),
      }).catch((err) => {
        console.error(`Failed to trigger ${jobType} extractor:`, err);
      });
    } catch (_) {
      // Non-fatal — the extractor can also be triggered via a separate call
    }

    return new Response(
      JSON.stringify({
        success: true,
        project_file_id: projectFile.id,
        processing_job_id: job.id,
        job_type: jobType,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-file:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
