import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
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

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Get user's org
    const { data: profile } = await supabase
      .from("users").select("organization_id").eq("id", user.id).single()
    if (!profile?.organization_id) return NextResponse.json({ error: "No organization" }, { status: 400 })

    const { data: settings, error } = await supabase
      .from("ghl_integration_settings")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(settings ?? null)
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("users").select("organization_id").eq("id", user.id).single()
    if (!profile?.organization_id) return NextResponse.json({ error: "No organization" }, { status: 400 })

    const body = await req.json()

    const { data: settings, error } = await supabase
      .from("ghl_integration_settings")
      .upsert({ ...body, organization_id: profile.organization_id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(settings, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("users").select("organization_id").eq("id", user.id).single()
    if (!profile?.organization_id) return NextResponse.json({ error: "No organization" }, { status: 400 })

    const body = await req.json()
    delete body.id; delete body.organization_id

    const { data: settings, error } = await supabase
      .from("ghl_integration_settings")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("organization_id", profile.organization_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
