"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
} from "@/lib/api/rooms"

export function useRooms(projectId: string) {
  return useQuery({
    queryKey: ["rooms", projectId],
    queryFn: () => getRooms(projectId),
    enabled: !!projectId,
  })
}

export function useRoom(id: string) {
  return useQuery({
    queryKey: ["room", id],
    queryFn: () => getRoom(id),
    enabled: !!id,
  })
}

export function useCreateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createRoom,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rooms", data.project_id] })
      return data
    },
  })
}

export function useUpdateRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateRoom>[1] }) =>
      updateRoom(id, updates),
    onSuccess: (data) => {
      queryClient.setQueryData(["room", data.id], data)
      queryClient.invalidateQueries({ queryKey: ["rooms", data.project_id] })
      return data
    },
  })
}

export function useDeleteRoom() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] })
    },
  })
}
