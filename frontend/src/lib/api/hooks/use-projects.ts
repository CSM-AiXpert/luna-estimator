"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectsByCustomer,
  searchProjects,
} from "@/lib/api/projects"

export function useProjects(orgId: string, status?: string) {
  return useQuery({
    queryKey: ["projects", orgId, status],
    queryFn: () => getProjects(orgId, status),
    enabled: !!orgId,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
    enabled: !!id,
  })
}

export function useProjectsByCustomer(customerId: string) {
  return useQuery({
    queryKey: ["projects", "customer", customerId],
    queryFn: () => getProjectsByCustomer(customerId),
    enabled: !!customerId,
  })
}

export function useSearchProjects(orgId: string, query: string) {
  return useQuery({
    queryKey: ["projects", orgId, "search", query],
    queryFn: () => searchProjects(orgId, query),
    enabled: !!orgId && query.length > 0,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      return data
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateProject>[1] }) =>
      updateProject(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.setQueryData(["project", data.id], data)
      return data
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}
