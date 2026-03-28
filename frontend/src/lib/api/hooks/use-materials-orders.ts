"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getMaterialsOrders,
  getMaterialsOrder,
  createMaterialsOrder,
  updateMaterialsOrder,
  deleteMaterialsOrder,
  updateMaterialsOrderItem,
  addMaterialsOrderItem,
  deleteMaterialsOrderItem,
  recalculateMaterialsOrder,
} from "@/lib/api/materials-orders"

export function useMaterialsOrders(projectId: string) {
  return useQuery({
    queryKey: ["materials-orders", projectId],
    queryFn: () => getMaterialsOrders(projectId),
    enabled: !!projectId,
  })
}

export function useMaterialsOrder(id: string | null) {
  return useQuery({
    queryKey: ["materials-order", id],
    queryFn: () => (id ? getMaterialsOrder(id) : null),
    enabled: !!id,
  })
}

export function useCreateMaterialsOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createMaterialsOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials-orders", data.project_id] })
      return data
    },
  })
}

export function useUpdateMaterialsOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Parameters<typeof updateMaterialsOrder>[1]
    }) => updateMaterialsOrder(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials-orders", data.project_id] })
      queryClient.invalidateQueries({ queryKey: ["materials-order", data.id] })
      return data
    },
  })
}

export function useDeleteMaterialsOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteMaterialsOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials-orders"] })
    },
  })
}

export function useUpdateMaterialsOrderItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Parameters<typeof updateMaterialsOrderItem>[1]
    }) => updateMaterialsOrderItem(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials-order", data.materials_order_id] })
      return data
    },
  })
}

export function useAddMaterialsOrderItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addMaterialsOrderItem,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials-order", data.materials_order_id] })
      return data
    },
  })
}

export function useDeleteMaterialsOrderItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteMaterialsOrderItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials-orders"] })
    },
  })
}

export function useRecalculateMaterialsOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recalculateMaterialsOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["materials-order", data.id] })
      return data
    },
  })
}
