import { supabase } from "@/lib/supabase/client"
import type { Customer, CustomerInsert, CustomerUpdate } from "@/lib/supabase/types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getCustomers(orgId: string): Promise<Customer[]> {
  const { data, error } = await db.from("customers").select("*").eq("organization_id", orgId).order("created_at", { ascending: false })
  if (error) throw error
  return (data as Customer[]) ?? []
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data, error } = await db.from("customers").select("*").eq("id", id).single()
  if (error) throw error
  return data as Customer
}

export async function createCustomer(customer: CustomerInsert): Promise<Customer> {
  const payload = { ...customer, created_at: new Date().toISOString() }
  const { data, error } = await db.from("customers").insert(payload).select().single()
  if (error) throw error
  return data as Customer
}

export async function updateCustomer(id: string, updates: CustomerUpdate): Promise<Customer> {
  const payload = { ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await db.from("customers").update(payload).eq("id", id).select().single()
  if (error) throw error
  return data as Customer
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await db.from("customers").delete().eq("id", id)
  if (error) throw error
}

export async function searchCustomers(orgId: string, query: string): Promise<Customer[]> {
  const { data, error } = await db
    .from("customers").select("*").eq("organization_id", orgId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data as Customer[]) ?? []
}
