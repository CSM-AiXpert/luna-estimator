"use client"

import { useState, useCallback } from "react"
import { useCreateProjectFile, useProjectFiles, useRoomFiles, useDeleteFile } from "@/lib/api/hooks/use-files"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Upload, FileText, Image, Box, X, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase/client"

interface FileUploaderProps {
  projectId: string
  roomId: string | null
}

export function FileUploader({ projectId, roomId }: FileUploaderProps) {
  const { toast } = useToast()
  const [isDragging, setIsDragging] = useState(false)
  const createFile = useCreateProjectFile()
  const deleteFile = useDeleteFile()
  const { data: projectFiles = [] } = useProjectFiles(projectId)
  const { data: roomFiles = [] } = useRoomFiles(roomId ?? "")
  const displayFiles = roomId ? roomFiles : projectFiles

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = Array.from(e.dataTransfer.files)
      await uploadFiles(dropped)
    },
    [projectId, roomId]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? [])
      await uploadFiles(selected)
      e.target.value = ""
    },
    [projectId, roomId]
  )

  async function uploadFiles(fileList: File[]) {
    for (const file of fileList) {
      const isImage = file.type.startsWith("image/")
      const isPdf = file.type === "application/pdf"
      const fileType = isImage ? "image" : isPdf ? "pdf" : "model"

      // Upload to storage
      const filePath = `${projectId}/${roomId ?? "general"}/${Date.now()}_${file.name}`
      const sb = getSupabaseClient()
      if (!sb) { toast({ title: "Upload failed: auth unavailable" }); continue }
      const { error: storageError } = await sb.storage
        .from("project-files")
        .upload(filePath, file, { cacheControl: "3600", upsert: false })

      if (storageError) {
        toast({ title: `Failed to upload ${file.name}`, variant: "error" })
        continue
      }

      try {
        await createFile.mutateAsync({
          project_id: projectId,
          room_id: roomId,
          storage_path: filePath,
          file_name: file.name,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.type,
          source: "upload",
          processing_status: "pending",
        })

        // Also create a room_photos record for images (needed by AI visualizer)
        if (isImage && roomId && sb) {
          const fileRecord = await sb
            .from("project_files")
            .select("id")
            .eq("storage_path", filePath)
            .eq("room_id", roomId)
            .single()
          if (fileRecord.data) {
            // @ts-ignore - room_photos insert for AI visualizer integration
            await sb.from("room_photos").insert({
              room_id: roomId,
              storage_path: filePath,
              file_name: file.name,
              file_type: file.type,
              file_size: file.size,
              is_primary: false,
            })
          }
        }
      } catch {
        toast({ title: `Failed to save ${file.name} to database`, variant: "error" })
      }
    }
    toast({ title: `${fileList.length} file(s) uploaded` })
  }

  async function handleDelete(id: string) {
    try {
      await deleteFile.mutateAsync(id)
      toast({ title: "File deleted" })
    } catch {
      toast({ title: "Failed to delete file", variant: "error" })
    }
  }

  const STATUS_ICONS: Record<string, React.ReactNode> = {
    pending: <Clock className="h-4 w-4 text-yellow-400" />,
    uploaded: <Clock className="h-4 w-4 text-yellow-400" />,
    queued: <Clock className="h-4 w-4 text-yellow-400" />,
    processing: <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />,
    extracting: <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
    failed: <AlertCircle className="h-4 w-4 text-red-400" />,
  }

  const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
    image: <Image className="h-5 w-5 text-[#00d4ff]" />,
    pdf: <FileText className="h-5 w-5 text-red-400" />,
    model: <Box className="h-5 w-5 text-purple-400" />,
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer",
          isDragging
            ? "border-[#00d4ff] bg-[#00d4ff]/5"
            : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
        )}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-white/30" />
        <p className="text-white/50 text-sm">
          Drag & drop files here, or{" "}
          <span className="text-[#00d4ff]">browse</span>
        </p>
        <p className="text-white/20 text-xs mt-1">JPEG, PNG, HEIC, PDF, OBJ, GLTF, PLY</p>
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/heic,application/pdf,.obj,.glb,.gltf,.ply,.dxf,.csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {createFile.isPending && (
        <div className="flex items-center gap-3 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin text-[#00d4ff]" />
          Uploading...
        </div>
      )}

      {displayFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/70">Uploaded Files</h3>
          <div className="space-y-2">
            {displayFiles.map((file) => (
              <Card key={file.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {FILE_TYPE_ICONS[file.file_type] ?? (
                      <FileText className="h-5 w-5 text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{file.file_name}</p>
                    <p className="text-xs text-white/30">
                      {formatDate(file.created_at)} &middot;{" "}
                      {(file.file_size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      {STATUS_ICONS[file.processing_status]}
                      <span className="text-xs text-white/40 capitalize">
                        {file.processing_status}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDelete(file.id)}
                      className="text-white/30 hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
