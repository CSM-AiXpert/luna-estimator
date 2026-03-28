"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getProjectFiles,
  getRoomFiles,
  createProjectFile,
  deleteProjectFile,
  updateFileProcessingStatus,
} from "@/lib/api/files"
import type { ProjectFile } from "@/lib/supabase/types"

export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ["files", "project", projectId],
    queryFn: () => getProjectFiles(projectId),
    enabled: !!projectId,
  })
}

export function useRoomFiles(roomId: string) {
  return useQuery({
    queryKey: ["files", "room", roomId],
    queryFn: () => getRoomFiles(roomId),
    enabled: !!roomId,
  })
}

export function useCreateProjectFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: Partial<ProjectFile>) => createProjectFile(file),
    onSuccess: (data) => {
      if (data.room_id) {
        queryClient.invalidateQueries({ queryKey: ["files", "room", data.room_id] })
      }
      if (data.project_id) {
        queryClient.invalidateQueries({ queryKey: ["files", "project", data.project_id] })
      }
      return data
    },
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProjectFile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] })
    },
  })
}

export function useUpdateFileProcessingStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      errorMessage,
      metadata,
    }: {
      id: string
      status: ProjectFile["processing_status"]
      errorMessage?: string
      metadata?: Record<string, unknown>
    }) => updateFileProcessingStatus(id, status, errorMessage, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] })
    },
  })
}
