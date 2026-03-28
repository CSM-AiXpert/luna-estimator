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

// POST /api/ghl-settings/connect
// Exchanges GHL OAuth credentials for access/refresh tokens
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    // @ts-ignore — Supabase types infer user as never in some configs
    const authUser = user as { id: string } | null
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await (supabase
      .from("users") as any).select("organization_id").eq("id", authUser.id).single()
    if (!profile?.organization_id) return NextResponse.json({ error: "No organization" }, { status: 400 })

    const { clientId, clientSecret, locationId } = await req.json()
    if (!clientId || !clientSecret || !locationId) {
      return NextResponse.json({ error: "clientId, clientSecret, locationId required" }, { status: 400 })
    }

    // Exchange client credentials for tokens via GHL OAuth
    const tokenRes = await fetch("https://services.leadconnectorhq.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}))
      return NextResponse.json({ error: err.message ?? "GHL OAuth failed — check credentials" }, { status: 401 })
    }

    const tokens = await tokenRes.json()
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    // Save settings with tokens
    const { data: settings, error } = await (supabase
      .from("ghl_integration_settings") as any)
      .upsert({
        organization_id: profile.organization_id,
        is_active: true,
        auth_type: "client_credentials",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        location_id: locationId,
        field_mappings: {},
        auto_sync_contacts: true,
        auto_sync_estimates: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, is_active: settings.is_active })
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
