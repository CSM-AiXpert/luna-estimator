import { supabase } from "@/lib/supabase/client"

// =============================================================================
// TYPES
// =============================================================================

export type MaterialsOrderStatus = "draft" | "ordered" | "partial" | "received" | "cancelled"

export interface MaterialsOrder {
  id: string
  project_id: string
  estimate_id: string | null
  version: number
  status: MaterialsOrderStatus
  notes: string | null
  supplier_name: string | null
  order_date: string | null
  expected_delivery: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  items?: MaterialsOrderItem[]
}

export interface MaterialsOrderItem {
  id: string
  materials_order_id: string
  category: string
  description: string
  supplier_part_number: string | null
  brand: string | null
  quantity: number
  unit: string
  unit_cost: number
  total_cost: number
  is_ordered: boolean
  ordered_quantity: number | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// =============================================================================
// API CALLS
// =============================================================================

export async function getMaterialsOrders(projectId: string): Promise<MaterialsOrder[]> {
  const { data, error } = await db
    .from("materials_orders")
    .select("*, items:materials_order_items(*)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data as MaterialsOrder[]) ?? []
}

export async function getMaterialsOrder(id: string): Promise<MaterialsOrder | null> {
  const { data, error } = await db
    .from("materials_orders")
    .select("*, items:materials_order_items(*)")
    .eq("id", id)
    .single()

  if (error && error.code !== "PGRST116") throw error
  return data as MaterialsOrder | null
}

export async function createMaterialsOrder(
  projectId: string
): Promise<MaterialsOrder> {
  const { data, error } = await db
    .from("materials_orders")
    .insert({
      project_id: projectId,
      version: 1,
      status: "draft",
      subtotal: 0,
      tax_rate: 0,
      tax_amount: 0,
      total: 0,
    })
    .select("*, items:materials_order_items(*)")
    .single()

  if (error) throw error
  return data as MaterialsOrder
}

export async function updateMaterialsOrder(
  id: string,
  updates: Partial<MaterialsOrder>
): Promise<MaterialsOrder> {
  const { data, error } = await db
    .from("materials_orders")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as MaterialsOrder
}

export async function deleteMaterialsOrder(id: string): Promise<void> {
  const { error } = await db.from("materials_orders").delete().eq("id", id)
  if (error) throw error
}

export async function updateMaterialsOrderItem(
  id: string,
  updates: Partial<MaterialsOrderItem>
): Promise<MaterialsOrderItem> {
  const { data, error } = await db
    .from("materials_order_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as MaterialsOrderItem
}

export async function deleteMaterialsOrderItem(id: string): Promise<void> {
  const { error } = await db.from("materials_order_items").delete().eq("id", id)
  if (error) throw error
}

export async function addMaterialsOrderItem(
  item: Omit<MaterialsOrderItem, "id" | "created_at" | "updated_at">
): Promise<MaterialsOrderItem> {
  const { data, error } = await db
    .from("materials_order_items")
    .insert({ ...item, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) throw error
  return data as MaterialsOrderItem
}

export async function recalculateMaterialsOrder(orderId: string): Promise<MaterialsOrder> {
  // Fetch all items
  const { data: items, error: itemsError } = await db
    .from("materials_order_items")
    .select("total_cost")
    .eq("materials_order_id", orderId)

  if (itemsError) throw itemsError

  const subtotal = (items ?? []).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, item: any) => sum + (item.total_cost || 0),
    0
  )
  const tax_rate = 0
  const tax_amount = 0
  const total = subtotal + tax_amount

  return updateMaterialsOrder(orderId, {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_rate,
    tax_amount,
    total: Math.round(total * 100) / 100,
  })
}
