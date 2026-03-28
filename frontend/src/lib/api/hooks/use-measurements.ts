"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getMeasurements,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
  bulkCreateMeasurements,
} from "@/lib/api/measurements"

export function useMeasurements(roomId: string) {
  return useQuery({
    queryKey: ["measurements", roomId],
    queryFn: () => getMeasurements(roomId),
    enabled: !!roomId,
  })
}

export function useCreateMeasurement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createMeasurement,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["measurements", data.room_id] })
      return data
    },
  })
}

export function useUpdateMeasurement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateMeasurement>[1] }) =>
      updateMeasurement(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["measurements", data.room_id] })
      return data
    },
  })
}

export function useDeleteMeasurement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteMeasurement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["measurements"] })
    },
  })
}

export function useBulkCreateMeasurements() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: bulkCreateMeasurements,
    onSuccess: (data) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["measurements", data[0].room_id] })
      }
      return data
    },
  })
}
