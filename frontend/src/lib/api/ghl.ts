import { supabase } from "@/lib/supabase/client"
import type { GhLIntegrationSettings } from "@/lib/supabase/types"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export async function getGhlSettings(orgId: string): Promise<GhLIntegrationSettings | null> {
  const { data, error } = await db
    .from("ghl_integration_settings")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle()
  if (error && error.code !== "PGRST116") throw error
  return data as GhLIntegrationSettings | null
}

export async function saveGhlSettings(orgId: string, settings: Partial<GhLIntegrationSettings>): Promise<GhLIntegrationSettings> {
  const r1 = await db.from("ghl_integration_settings").select("id").eq("organization_id", orgId).maybeSingle()
  if (r1.data) {
    const p = { ...settings, updated_at: new Date().toISOString() }
    const r2 = await db.from("ghl_integration_settings").update(p).eq("organization_id", orgId).select().single()
    if (r2.error) throw r2.error
    return r2.data as GhLIntegrationSettings
  } else {
    const r2 = await db.from("ghl_integration_settings").insert({ organization_id: orgId, ...settings }).select().single()
    if (r2.error) throw r2.error
    return r2.data as GhLIntegrationSettings
  }
}

export async function testGhlConnection(locationId: string, token: string): Promise<boolean> {
  const response = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
    headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28" },
  })
  return response.ok
}

export async function syncToGhl(projectId: string) {
  const { data, error } = await db.functions.invoke("sync-to-ghl", { body: { projectId } })
  if (error) throw error
  return data
}
