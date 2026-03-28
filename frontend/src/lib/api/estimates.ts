import { supabase } from "@/lib/supabase/client"
import type { Estimate, EstimateInsert, EstimateUpdate, EstimateItem, EstimateItemInsert, EstimateItemUpdate } from "@/lib/supabase/types"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

type EstWithItems = Estimate & { line_items?: EstimateItem[] }

export async function getEstimate(projectId: string): Promise<EstWithItems | null> {
  const r1 = await db.from("estimates").select("*").eq("project_id", projectId).maybeSingle()
  if (r1.error && r1.error.code !== "PGRST116") throw r1.error
  if (!r1.data) return null
  const r2 = await db.from("estimate_items").select("*").eq("estimate_id", r1.data.id).order("sort_order", { ascending: true })
  return { ...r1.data, line_items: r2.data ?? [] } as EstWithItems
}

export async function createEstimate(estimate: EstimateInsert, lineItems?: EstimateItemInsert[]): Promise<EstWithItems> {
  const ep = { ...estimate, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  const r1 = await db.from("estimates").insert(ep).select().single()
  if (r1.error) throw r1.error
  if (lineItems && lineItems.length > 0) {
    const payload = lineItems.map(item => ({ ...item, estimate_id: r1.data.id }))
    const r2 = await db.from("estimate_items").insert(payload).select()
    return { ...r1.data, line_items: r2.data ?? [] } as EstWithItems
  }
  return { ...r1.data, line_items: [] } as EstWithItems
}

export async function updateEstimate(id: string, updates: EstimateUpdate): Promise<Estimate> {
  const p = { ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await db.from("estimates").update(p).eq("id", id).select().single()
  if (error) throw error
  return data as Estimate
}

export async function updateEstimateStatus(id: string, status: Estimate["status"]): Promise<Estimate> {
  const updates: Record<string, unknown> = { status }
  if (status === "sent") updates.sent_at = new Date().toISOString()
  if (status === "approved") updates.approved_at = new Date().toISOString()
  return updateEstimate(id, updates as EstimateUpdate)
}

export async function addEstimateLineItem(item: EstimateItemInsert): Promise<EstimateItem> {
  const { data, error } = await db.from("estimate_items").insert(item).select().single()
  if (error) throw error
  return data as EstimateItem
}

export async function updateEstimateLineItem(id: string, updates: EstimateItemUpdate): Promise<EstimateItem> {
  const p = { ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await db.from("estimate_items").update(p).eq("id", id).select().single()
  if (error) throw error
  return data as EstimateItem
}

export async function deleteEstimateLineItem(id: string): Promise<void> {
  const { error } = await db.from("estimate_items").delete().eq("id", id)
  if (error) throw error
}

export async function recalculateEstimateTotals(estimateId: string): Promise<Estimate | null> {
  const r1 = await db.from("estimate_items").select("unit_cost, quantity").eq("estimate_id", estimateId)
  const subtotal = (r1.data ?? []).reduce((sum: number, item: { unit_cost: number; quantity: number }) => sum + item.unit_cost * item.quantity, 0)
  const r2 = await db.from("estimates").select("markup_rate, tax_rate").eq("id", estimateId).single()
  if (!r2.data) return null
  const markup_amount = subtotal * ((r2.data.markup_rate ?? 0) / 100)
  const taxable = subtotal + markup_amount
  const tax_amount = taxable * ((r2.data.tax_rate ?? 0) / 100)
  const total = taxable + tax_amount
  return updateEstimate(estimateId, { subtotal, markup_amount, tax_amount, total })
}
