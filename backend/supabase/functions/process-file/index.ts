/**
 * process-file — Supabase Edge Function
 * 
 * Main entry point for file processing.
 * Classifies uploaded files and creates processing jobs for measurement extraction.
 * 
 * POST /
 * Body: {
 *   projectId: string,
 *   roomId?: string,
 *   filePath: string,        // Storage path, e.g., "rooms/room-123/scans/scan.obj"
 *   fileName: string,        // Original filename
 *   fileType?: string,      // Optional: override file type detection
 *   mimeType: string,       // MIME type
 * }
 * 
 * Headers: {
 *   authorization: "Bearer <jwt>"  // Required for org validation
 * }
 * 
 * Response: {
 *   jobId: string,
 *   projectFileId: string,
 *   status: "queued"
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FileType = "image" | "pdf" | "obj" | "gltf" | "glb" | "ply" | "csv" | "dxf" | "unknown";

const FILE_TYPE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,     // 10MB
  pdf: 50 * 1024 * 1024,       // 50MB
  obj: 100 * 1024 * 1024,      // 100MB
  gltf: 100 * 1024 * 1024,     // 100MB
  glb: 100 * 1024 * 1024,      // 100MB
  ply: 200 * 1024 * 1024,      // 200MB
  dxf: 20 * 1024 * 1024,       // 20MB
  csv: 5 * 1024 * 1024,         // 5MB
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
  "text/plain": "csv", // Could be CSV
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

const TYPE_TO_ESTIMATED_DURATION: Record<FileType, number> = {
  image: 15,
  pdf: 30,
  obj: 20,
  gltf: 25,
  glb: 25,
  ply: 30,
  csv: 5,
  dxf: 0,
  unknown: 0,
};

/**
 * Classify file based on extension and/or MIME type
 */
function classifyFile(fileName: string, mimeType: string): { fileType: FileType; error?: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  let fileType: FileType;
  
  switch (ext) {
    case "png":
    case "jpg":
    case "jpeg":
      fileType = "image";
      break;
    case "pdf":
      fileType = "pdf";
      break;
    case "obj":
      fileType = "obj";
      break;
    case "gltf":
      fileType = "gltf";
      break;
    case "glb":
      fileType = "glb";
      break;
    case "ply":
      fileType = "ply";
      break;
    case "csv":
      fileType = "csv";
      break;
    case "dxf":
      fileType = "dxf";
      break;
    default:
      // Fall back to MIME type
      fileType = MIME_TO_TYPE[mimeType] || "unknown";
  }

  return { fileType };
}

/**
 * Validate JWT and extract organization ID
 */
function validateAuth(authHeader: string | null): { userId: string; organizationId: string } | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authHeader.slice(7);
    // JWT payload is base64-encoded JSON
    const payload = JSON.parse(atob(token.split(".")[1]));
    
    // Validate required fields exist
    if (!payload.sub || !payload.organization_id) {
      return null;
    }

    return {
      userId: payload.sub,
      organizationId: payload.organization_id,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Validate auth
    const authHeader = req.headers.get("authorization");
    const auth = validateAuth(authHeader);
    
    if (!auth) {
      return new Response(JSON.stringify({
        error: "UNAUTHORIZED",
        message: "Valid JWT with organization_id required",
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, organizationId } = auth;

    // 2. Parse request body
    const body = await req.json();
    const { projectId, roomId, filePath, fileName, fileType: overrideFileType, mimeType } = body;

    // Validate required fields
    if (!projectId || !filePath || !fileName) {
      return new Response(JSON.stringify({
        error: "MISSING_FIELDS",
        message: "projectId, filePath, and fileName are required",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Classify file
    const { fileType, error: classError } = classifyFile(fileName, mimeType || "application/octet-stream");
    
    const finalFileType = (overrideFileType as FileType) || fileType;

    if (finalFileType === "unknown") {
      return new Response(JSON.stringify({
        error: "UNSUPPORTED_FORMAT",
        message: `File type not supported: ${fileName}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Verify project exists and belongs to organization
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, organization_id")
      .eq("id", projectId)
      .eq("organization_id", organizationId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({
        error: "PROJECT_NOT_FOUND",
        message: "Project not found or access denied",
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Generate IDs
    const projectFileId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    // 7. Check if DXF (unsupported format)
    if (finalFileType === "dxf") {
      // Create project_file record with unsupported status
      await supabase
        .from("project_files")
        .insert({
          id: projectFileId,
          project_id: projectId,
          room_id: roomId || null,
          file_path: filePath,
          file_name: fileName,
          file_type: finalFileType,
          mime_type: mimeType,
          processing_status: "unsupported_format",
          organization_id: organizationId,
          uploaded_by: userId,
          uploaded_at: new Date().toISOString(),
        });

      return new Response(JSON.stringify({
        jobId: null,
        projectFileId,
        status: "unsupported_format",
        message: "DXF format is not currently supported for measurement extraction",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 8. Create project_file record with queued status
    const { error: fileInsertError } = await supabase
      .from("project_files")
      .insert({
        id: projectFileId,
        project_id: projectId,
        room_id: roomId || null,
        file_path: filePath,
        file_name: fileName,
        file_type: finalFileType,
        mime_type: mimeType,
        processing_status: "queued",
        organization_id: organizationId,
        uploaded_by: userId,
        uploaded_at: new Date().toISOString(),
      });

    if (fileInsertError) {
      console.error("Failed to insert project_file:", fileInsertError);
      return new Response(JSON.stringify({
        error: "DB_INSERT_FAILED",
        message: "Failed to create file record",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 9. Create processing_job record
    const processorFunction = TYPE_TO_PROCESSOR[finalFileType];
    const estimatedDuration = TYPE_TO_ESTIMATED_DURATION[finalFileType];

    const { error: jobInsertError } = await supabase
      .from("processing_jobs")
      .insert({
        id: jobId,
        project_file_id: projectFileId,
        room_id: roomId || null,
        organization_id: organizationId,
        user_id: userId,
        file_path: filePath,
        file_name: fileName,
        file_type: finalFileType,
        status: "queued",
        processor_function: processorFunction,
        estimated_duration_seconds: estimatedDuration,
        created_at: new Date().toISOString(),
      });

    if (jobInsertError) {
      console.error("Failed to insert processing_job:", jobInsertError);
      
      // Rollback project_file
      await supabase.from("project_files").delete().eq("id", projectFileId);
      
      return new Response(JSON.stringify({
        error: "DB_INSERT_FAILED",
        message: "Failed to create processing job",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10. Update project_file with processing_job_id
    await supabase
      .from("project_files")
      .update({ processing_job_id: jobId })
      .eq("id", projectFileId);

    // 11. Return success response
    return new Response(JSON.stringify({
      jobId,
      projectFileId,
      status: "queued",
      processor: processorFunction,
      estimated_duration_seconds: estimatedDuration,
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("process-file error:", err);
    return new Response(JSON.stringify({
      error: "INTERNAL_ERROR",
      message: err instanceof Error ? err.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
