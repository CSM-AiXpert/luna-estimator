import { supabase } from "@/lib/supabase/client"
import type { Project, ProjectInsert, ProjectUpdate } from "@/lib/supabase/types"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getProjects(orgId: string, status?: string): Promise<Project[]> {
  let q = db.from("projects").select("*, customer:customers(id, first_name, last_name, email)").eq("organization_id", orgId).order("created_at", { ascending: false })
  if (status) q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw error
  return (data as Project[]) ?? []
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await db.from("projects").select("*, customer:customers(id, first_name, last_name, email)").eq("id", id).single()
  if (error) throw error
  return data as Project
}

export async function createProject(project: ProjectInsert): Promise<Project> {
  const p = { ...project, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  const { data, error } = await db.from("projects").insert(p).select().single()
  if (error) throw error
  return data as Project
}

export async function updateProject(id: string, updates: ProjectUpdate): Promise<Project> {
  const p = { ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await db.from("projects").update(p).eq("id", id).select().single()
  if (error) throw error
  return data as Project
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await db.from("projects").delete().eq("id", id)
  if (error) throw error
}

export async function getProjectsByCustomer(customerId: string): Promise<Project[]> {
  const { data, error } = await db.from("projects").select("*, customer:customers(id, first_name, last_name, email)").eq("customer_id", customerId).order("created_at", { ascending: false })
  if (error) throw error
  return (data as Project[]) ?? []
}

export async function searchProjects(orgId: string, query: string): Promise<Project[]> {
  const { data, error } = await db.from("projects").select("*, customer:customers(id, first_name, last_name, email)").eq("organization_id", orgId).or(`name.ilike.%${query}%,address.ilike.%${query}%`).order("created_at", { ascending: false })
  if (error) throw error
  return (data as Project[]) ?? []
}
