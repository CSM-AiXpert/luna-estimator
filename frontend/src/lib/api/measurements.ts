import { supabase } from "@/lib/supabase/client"
import type { Measurement, MeasurementInsert, MeasurementUpdate } from "@/lib/supabase/types"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getMeasurements(roomId: string): Promise<Measurement[]> {
  const { data, error } = await db.from("measurements").select("*").eq("room_id", roomId).order("wall_index", { ascending: true })
  if (error) throw error
  return (data as Measurement[]) ?? []
}

export async function createMeasurement(measurement: MeasurementInsert): Promise<Measurement> {
  const { data, error } = await db.from("measurements").insert(measurement).select().single()
  if (error) throw error
  return data as Measurement
}

export async function updateMeasurement(id: string, updates: MeasurementUpdate): Promise<Measurement> {
  const p = { ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await db.from("measurements").update(p).eq("id", id).select().single()
  if (error) throw error
  return data as Measurement
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { error } = await db.from("measurements").delete().eq("id", id)
  if (error) throw error
}

export async function bulkCreateMeasurements(measurements: MeasurementInsert[]): Promise<Measurement[]> {
  const { data, error } = await db.from("measurements").insert(measurements).select()
  if (error) throw error
  return data ?? []
}
