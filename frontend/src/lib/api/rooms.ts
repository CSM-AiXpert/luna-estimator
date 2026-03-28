import { supabase } from "@/lib/supabase/client"
import type { Room, RoomInsert, RoomUpdate } from "@/lib/supabase/types"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getRooms(projectId: string): Promise<Room[]> {
  const { data, error } = await db.from("rooms").select("*").eq("project_id", projectId).order("sort_order", { ascending: true })
  if (error) throw error
  return (data as Room[]) ?? []
}

export async function getRoom(id: string): Promise<Room> {
  const { data, error } = await db.from("rooms").select("*").eq("id", id).single()
  if (error) throw error
  return data as Room
}

export async function createRoom(room: RoomInsert): Promise<Room> {
  const p = { ...room, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  const { data, error } = await db.from("rooms").insert(p).select().single()
  if (error) throw error
  return data as Room
}

export async function updateRoom(id: string, updates: RoomUpdate): Promise<Room> {
  const p = { ...updates, updated_at: new Date().toISOString() }
  const { data, error } = await db.from("rooms").update(p).eq("id", id).select().single()
  if (error) throw error
  return data as Room
}

export async function deleteRoom(id: string): Promise<void> {
  const { error } = await db.from("rooms").delete().eq("id", id)
  if (error) throw error
}
