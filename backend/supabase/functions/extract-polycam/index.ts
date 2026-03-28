// extract-polycam/index.ts
// Parses OBJ/GLTF/GLB/PLY, extracts room dimensions using AI

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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
    const fileName = inputData.file_name;
    const roomId = inputData.room_id;

    // Determine file type
    const isOBJ = fileName.endsWith(".obj");
    const isGLTF = fileName.endsWith(".gltf");
    const isGLB = fileName.endsWith(".glb");
    const isPLY = fileName.endsWith(".ply");

    // Download file from storage
    const bucketName = "project-files";
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    let rawText = "";
    let extractedMeasurements: {
      category: string;
      measurement_type: string;
      label: string;
      value: number;
      unit: string;
      confidence_score: number;
    }[] = [];

    if (isOBJ) {
      // Parse OBJ text content
      const text = await fileData.text();
      rawText = text;

      // Extract vertex data for dimension calculation
      const vertices: number[][] = [];
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("v ")) {
          const parts = trimmed.slice(2).trim().split(/\s+/);
          if (parts.length >= 3) {
            vertices.push([parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2])]);
          }
        }
      }

      // Send OBJ content + vertex analysis to OpenAI
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
              content: `You are a 3D scan analysis specialist. Given OBJ file data from a room scan (Polycam or similar), extract room dimensions and measurements.

Return JSON:
{
  "measurements": [
    {
      "category": "wall|ceiling|floor|misc",
      "measurement_type": "square_foot|linear_foot",
      "label": "e.g., Room Width, Room Length, Wall Area (North)",
      "value": number,
      "unit": "sqft|lf",
      "confidence_score": 0.0-1.0
    }
  ],
  "summary": "Description of room dimensions found",
  "voxel_stats": {
    "min_x": number, "max_x": number, "width_ft": number,
    "min_y": number, "max_y": number, "height_ft": number,
    "min_z": number, "max_z": number, "depth_ft": number
  }
}`,
            },
            {
              role: "user",
              content: `Analyze this OBJ file from a room 3D scan. Extract all room dimensions and measurements. Count vertices: ${vertices.length}

First 50 lines of OBJ:
${text.split("\n").slice(0, 50).join("\n")}

${vertices.length > 0 ? `
Vertex bounding box (x,y,z):
Min X: ${Math.min(...vertices.map((v) => v[0])).toFixed(3)}
Max X: ${Math.max(...vertices.map((v) => v[0])).toFixed(3)}
Min Y: ${Math.min(...vertices.map((v) => v[1])).toFixed(3)}
Max Y: ${Math.max(...vertices.map((v) => v[1])).toFixed(3)}
Min Z: ${Math.min(...vertices.map((v) => v[2])).toFixed(3)}
Max Z: ${Math.max(...vertices.map((v) => v[2])).toFixed(3)}
` : ""}`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 2048,
        }),
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${await openaiResponse.text()}`);
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          extractedMeasurements = parsed.measurements || [];
        } catch {
          console.error("Failed to parse OpenAI response");
        }
      }
    } else if (isGLTF || isGLB) {
      // Parse GLTF/GLB (binary) — send raw structure to OpenAI for analysis
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // For GLB, extract JSON chunk text
      let gltfJson = "";
      if (isGLB) {
        // GLB header: 12 bytes (magic, version, length)
        // Then chunks: (uint32 length, uint32 type, data)
        // type 0x4E4F5346 = JSON, type 0x004E4942 = BIN
        let offset = 12;
        while (offset < uint8Array.length) {
          const chunkLength = new DataView(arrayBuffer, offset, 4).getUint32(0, true);
          const chunkType = new DataView(arrayBuffer, offset + 4, 4).getUint32(0, true);
          offset += 8;
          if (chunkType === 0x4e4f5346) {
            // JSON chunk
            const textDecoder = new TextDecoder();
            gltfJson = textDecoder.decode(uint8Array.slice(offset, offset + chunkLength));
            break;
          }
          offset += chunkLength;
        }
      } else {
        gltfJson = new TextDecoder().decode(uint8Array);
      }

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
              content: `You are a 3D scan analysis specialist. Given GLTF/GLB file structure from a room scan, estimate room dimensions.

Return JSON:
{
  "measurements": [
    {
      "category": "wall|ceiling|floor|misc",
      "measurement_type": "square_foot|linear_foot",
      "label": "Room dimension label",
      "value": number,
      "unit": "sqft|lf",
      "confidence_score": 0.0-1.0
    }
  ],
  "summary": "Description"
}`,
            },
            {
              role: "user",
              content: `Analyze this GLTF/GLB 3D scan file and extract room dimensions. Here is the structure:\n\n${gltfJson.slice(0, 3000)}`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1024,
        }),
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${await openaiResponse.text()}`);
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          extractedMeasurements = parsed.measurements || [];
        } catch {
          console.error("Failed to parse OpenAI response");
        }
      }
    } else if (isPLY) {
      // PLY files — extract vertex positions and analyze
      const text = await fileData.text();
      rawText = text;

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
              content: `You are a 3D scan analysis specialist. Given PLY file data from a room scan, extract room dimensions.

Return JSON:
{
  "measurements": [
    {
      "category": "wall|ceiling|floor|misc",
      "measurement_type": "square_foot|linear_foot",
      "label": "Room dimension label",
      "value": number,
      "unit": "sqft|lf",
      "confidence_score": 0.0-1.0
    }
  ],
  "summary": "Description"
}`,
            },
            {
              role: "user",
              content: `Analyze this PLY 3D scan file. First 100 lines:\n\n${text.split("\n").slice(0, 100).join("\n")}`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 1024,
        }),
      });

      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${await openaiResponse.text()}`);
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const parsed = JSON.parse(content);
          extractedMeasurements = parsed.measurements || [];
        } catch {
          console.error("Failed to parse OpenAI response");
        }
      }
    }

    // Insert measurements
    if (roomId && extractedMeasurements.length > 0) {
      const measurementRecords = extractedMeasurements.map((m) => ({
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

      await supabase.from("measurements").insert(measurementRecords);
    }

    // Mark job as completed
    await supabase
      .from("processing_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        output_data: {
          measurements_count: extractedMeasurements.length,
          file_type: isOBJ ? "obj" : isGLTF ? "gltf" : isGLB ? "glb" : "ply",
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
        measurements_count: extractedMeasurements.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in extract-polycam:", error);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { job_id } = await req.json().catch(() => ({}));

      if (job_id) {
        await supabase
          .from("processing_jobs")
          .update({ status: "failed", error_message: error.message })
          .eq("id", job_id);
      }
    } catch (_) {
      // ignore
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
