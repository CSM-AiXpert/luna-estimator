/**
 * process-file — Supabase Edge Function
 * 
 * Entry point for file processing. Validates auth, creates a project_files
 * record and a processing_jobs record, then returns immediately.
 * A pg_cron trigger fires when jobs are queued to invoke the extractor.
 * 
 * POST /
 * Body: {
 *   projectId: string,
 *   roomId?: string,
 *   filePath: string,        // Storage path in bucket
 *   fileName: string,        // Original filename
 *   mimeType: string,        // MIME type
 * }
 * 
 * Headers: {
 *   authorization: "Bearer <jwt>"  // Required for org validation
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FileType = "image" | "pdf" | "obj" | "gltf" | "glb" | "ply" | "csv" | "dxf" | "unknown";

const FILE_TYPE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
  obj: 100 * 1024 * 1024,
  gltf: 100 * 1024 * 1024,
  glb: 100 * 1024 * 1024,
  ply: 200 * 1024 * 1024,
  dxf: 20 * 1024 * 1024,
  csv: 5 * 1024 * 1024,
};

const MIME_TO_TYPE: Record<string, FileType> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/jpg": "image",
  "application/pdf": "pdf",
  "model/gltf+json": "gltf",
  "model/gltf-binary": "glb",
  "text/csv": "csv",
  "application/csv": "csv",
  "text/plain": "csv",
};

const TYPE_TO_PROCESSOR: Record<FileType, string> = {
  image: "extract-measurements",
  pdf: "extract-pdf",
  obj: "extract-polycam",
  gltf: "extract-polycam",
  glb: "extract-polycam",
  ply: "extract-polycam",
  csv: "extract-csv",
  dxf: "unsupported_format",
  unknown: "unsupported_format",
};

function classifyFile(fileName: string, mimeType: string): { fileType: FileType } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  let fileType: FileType;
  switch (ext) {
    case "png": case "jpg": case "jpeg": fileType = "image"; break;
    case "pdf": fileType = "pdf"; break;
    case "obj": fileType = "obj"; break;
    case "gltf": fileType = "gltf"; break;
    case "glb": fileType = "glb"; break;
    case "ply": fileType = "ply"; break;
    case "csv": fileType = "csv"; break;
    case "dxf": fileType = "dxf"; break;
    default: fileType = MIME_TO_TYPE[mimeType] || "unknown";
  }
  return { fileType };
}

/**
 * Validate JWT. In Supabase, the JWT is verified by the edge gateway —
 * we just decode the payload to read org/user info.
 */
function getOrgFromJWT(authHeader: string | null): { userId: string; organizationId: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = JSON.parse(atob(authHeader.slice(7).split(".")[1]));
    if (!payload.sub || !payload.organization_id) return null;
    return { userId: payload.sub, organizationId: payload.organization_id };
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Auth
    const auth = getOrgFromJWT(req.headers.get("authorization"));
    if (!auth) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { userId, organizationId } = auth;

    // 2. Parse body
    const { projectId, roomId, filePath, fileName, mimeType } = await req.json();
    if (!projectId || !filePath || !fileName) {
      return new Response(JSON.stringify({ error: "MISSING_FIELDS", message: "projectId, filePath, fileName required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Classify
    const { fileType } = classifyFile(fileName, mimeType || "application/octet-stream");
    if (fileType === "unknown") {
      return new Response(JSON.stringify({ error: "UNSUPPORTED_FORMAT" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Verify project belongs to org
    const { data: project } = await supabase
      .from("projects").select("id, organization_id").eq("id", projectId).eq("organization_id", organizationId).single();
    if (!project) {
      return new Response(JSON.stringify({ error: "PROJECT_NOT_FOUND" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Generate IDs
    const projectFileId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const processorFunction = TYPE_TO_PROCESSOR[fileType];

    // 7. DXF not supported — insert with failed status
    if (fileType === "dxf") {
      await supabase.from("project_files").insert({
        id: projectFileId,
        project_id: projectId,
        room_id: roomId || null,
        storage_path: filePath,
        file_name: fileName,
        file_type: "dxf",
        file_size: 0,
        mime_type: mimeType || "application/dxf",
        source: "upload",
        processing_status: "failed",
        processing_error: "DXF format not currently supported",
        metadata: { attempted_at: new Date().toISOString() },
      });
      return new Response(JSON.stringify({ projectFileId, status: "failed", message: "DXF not supported" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Insert project_files — only use columns that exist in the schema
    const { error: fileInsertError } = await supabase.from("project_files").insert({
      id: projectFileId,
      project_id: projectId,
      room_id: roomId || null,
      storage_path: filePath,
      file_name: fileName,
      file_type: fileType,
      file_size: 0, // file_size not available here — updated by processor
      mime_type: mimeType || "application/octet-stream",
      source: "upload",
      processing_status: "queued",
    });

    if (fileInsertError) {
      console.error("project_files insert error:", fileInsertError);
      return new Response(JSON.stringify({ error: "DB_INSERT_FAILED", message: "Failed to create file record" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Insert processing_jobs — only use columns that exist in the schema
    // Store processor context in input_data JSONB
    const { error: jobInsertError } = await supabase.from("processing_jobs").insert({
      id: jobId,
      project_file_id: projectFileId,
      job_type: processorFunction,
      status: "queued",
      input_data: {
        storage_path: filePath,
        room_id: roomId || null,
        file_name: fileName,
        file_type: fileType,
        user_id: userId,
      },
    });

    if (jobInsertError) {
      console.error("processing_jobs insert error:", jobInsertError);
      await supabase.from("project_files").delete().eq("id", projectFileId);
      return new Response(JSON.stringify({ error: "DB_INSERT_FAILED", message: "Failed to create job" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Return — pg_cron trigger handles invoking the extractor
    return new Response(JSON.stringify({
      jobId,
      projectFileId,
      status: "queued",
      processor: processorFunction,
    }), {
      status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("process-file error:", err);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: err instanceof Error ? err.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
