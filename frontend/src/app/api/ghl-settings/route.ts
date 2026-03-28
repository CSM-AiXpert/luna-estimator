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
    // @ts-ignore
    const { data: { user } } = await supabase.auth.getUser()
    // @ts-ignore
    const uid = (user as any)?.id
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // @ts-ignore
    const { data: profile } = await (supabase.from("users") as any)
      .select("organization_id").eq("id", uid).single()
    const orgId = (profile as any)?.organization_id
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 })

    // @ts-ignore
    const { data: settings, error } = await (supabase.from("ghl_integration_settings") as any)
      .select("*").eq("organization_id", orgId).maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(settings ?? null)
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    // @ts-ignore
    const { data: { user } } = await supabase.auth.getUser()
    // @ts-ignore
    const uid = (user as any)?.id
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // @ts-ignore
    const { data: profile } = await (supabase.from("users") as any)
      .select("organization_id").eq("id", uid).single()
    const orgId = (profile as any)?.organization_id
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 })

    const body = await req.json()

    // @ts-ignore
    const { data: settings, error } = await (supabase.from("ghl_integration_settings") as any)
      .upsert({ ...body, organization_id: orgId }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(settings, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    // @ts-ignore
    const { data: { user } } = await supabase.auth.getUser()
    // @ts-ignore
    const uid = (user as any)?.id
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // @ts-ignore
    const { data: profile } = await (supabase.from("users") as any)
      .select("organization_id").eq("id", uid).single()
    const orgId = (profile as any)?.organization_id
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 })

    const body = await req.json()
    delete body.id; delete body.organization_id

    // @ts-ignore
    const { data: settings, error } = await (supabase.from("ghl_integration_settings") as any)
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
