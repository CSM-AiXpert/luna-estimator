import { supabase } from "@/lib/supabase/client"
import type { ProjectFile } from "@/lib/supabase/types"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await db.from("project_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false })
  if (error) throw error
  return (data as ProjectFile[]) ?? []
}

export async function getRoomFiles(roomId: string): Promise<ProjectFile[]> {
  const { data, error } = await db.from("project_files").select("*").eq("room_id", roomId).order("created_at", { ascending: false })
  if (error) throw error
  return (data as ProjectFile[]) ?? []
}

export async function createProjectFile(file: Partial<ProjectFile>): Promise<ProjectFile> {
  const { data, error } = await db.from("project_files").insert(file).select().single()
  if (error) throw error
  return data as ProjectFile
}

export async function updateFileProcessingStatus(id: string, status: ProjectFile["processing_status"], errorMessage?: string, metadata?: Record<string, unknown>): Promise<ProjectFile> {
  const p = { processing_status: status, processing_error: errorMessage ?? null, metadata: metadata ?? null, updated_at: new Date().toISOString() }
  const { data, error } = await db.from("project_files").update(p).eq("id", id).select().single()
  if (error) throw error
  return data as ProjectFile
}

export async function deleteProjectFile(id: string): Promise<void> {
  const { error } = await db.from("project_files").delete().eq("id", id)
  if (error) throw error
}
