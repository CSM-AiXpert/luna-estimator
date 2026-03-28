import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/lib/supabase/types"

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* ignore */ }
        },
      },
    }
  )
}

// POST /api/ghl-settings/test
// Tests the GHL connection by fetching account info
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const uid = (user as any)?.id
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      (supabase.from("users") as any).select("organization_id").eq("id", uid).single()
    if (!(profile as any)?.organization_id) return NextResponse.json({ error: "No organization" }, { status: 400 })

    const { data: settings } = await supabase
      (supabase.from("ghl_integration_settings") as any)
      .select("access_token, location_id")
      .eq("organization_id", (profile as any)?.organization_id)
      .maybeSingle()

    if (!settings?.access_token) {
      return NextResponse.json({ ok: false, error: "Not connected to GHL" }, { status: 400 })
    }

    // Test: fetch account/location info from GHL
    const ghlRes = await fetch(
      `https://services.leadconnectorhq.com/locations/${settings.location_id}`,
      {
        headers: {
          Authorization: `Bearer ${settings.access_token}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
      }
    )

    if (!ghlRes.ok) {
      const err = await ghlRes.json().catch(() => ({}))
      return NextResponse.json({ ok: false, error: err.message ?? "GHL API error" }, { status: 401 })
    }

    const locationData = await ghlRes.json()
    return NextResponse.json({
      ok: true,
      locationName: locationData.name ?? locationData.business_name ?? settings.location_id,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Connection test failed" }, { status: 500 })
  }
}
