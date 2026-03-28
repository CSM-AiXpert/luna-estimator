"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  searchCustomers,
} from "@/lib/api/customers"

export function useCustomers(orgId: string) {
  return useQuery({
    queryKey: ["customers", orgId],
    queryFn: () => getCustomers(orgId),
    enabled: !!orgId,
  })
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: () => getCustomer(id),
    enabled: !!id,
  })
}

export function useSearchCustomers(orgId: string, query: string) {
  return useQuery({
    queryKey: ["customers", orgId, "search", query],
    queryFn: () => searchCustomers(orgId, query),
    enabled: !!orgId && query.length > 0,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      return data
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateCustomer>[1] }) =>
      updateCustomer(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      queryClient.setQueryData(["customer", data.id], data)
      return data
    },
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
    },
  })
}
