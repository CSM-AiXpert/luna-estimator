"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getEstimate,
  createEstimate,
  updateEstimate,
  updateEstimateStatus,
  addEstimateLineItem,
  updateEstimateLineItem,
  deleteEstimateLineItem,
  recalculateEstimateTotals,
} from "@/lib/api/estimates"

export function useEstimate(projectId: string) {
  return useQuery({
    queryKey: ["estimate", projectId],
    queryFn: () => getEstimate(projectId),
    enabled: !!projectId,
  })
}

export function useCreateEstimate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      estimate,
      lineItems,
    }: {
      estimate: Parameters<typeof createEstimate>[0]
      lineItems?: Parameters<typeof createEstimate>[1]
    }) => createEstimate(estimate, lineItems),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] })
      return data
    },
  })
}

export function useUpdateEstimate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Parameters<typeof updateEstimate>[1]
    }) => updateEstimate(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] })
      return data
    },
  })
}

export function useUpdateEstimateStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: Parameters<typeof updateEstimateStatus>[1]
    }) => updateEstimateStatus(id, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] })
      return data
    },
  })
}

export function useAddEstimateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addEstimateLineItem,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] })
      return data
    },
  })
}

export function useUpdateEstimateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Parameters<typeof updateEstimateLineItem>[1]
    }) => updateEstimateLineItem(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] })
      return data
    },
  })
}

export function useDeleteEstimateLineItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteEstimateLineItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] })
    },
  })
}

export function useRecalculateEstimateTotals() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recalculateEstimateTotals,
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["estimates"] })
      }
      return data
    },
  })
}
