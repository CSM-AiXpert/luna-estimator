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

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check user is admin or owner (skip if SUPABASE_SERVICE_ROLE_KEY not configured)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return NextResponse.json({ error: "Server config error" }, { status: 500 })

    // Check user's role in their org
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()
    if (!profile) return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    // @ts-ignore — profile.role may not be in generated types
    if (profile.role && !["owner", "admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { email, role } = await req.json()
    if (!email || !role) return NextResponse.json({ error: "email and role required" }, { status: 400 })

    // Call Supabase Auth admin to invite user
    const inviteUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/invite`

    const inviteRes = await fetch(inviteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        email,
        data: { role, organization_id: user.id }, // metadata
      }),
    })

    if (!inviteRes.ok) {
      const err = await inviteRes.json().catch(() => ({}))
      return NextResponse.json({ error: err.msg ?? err.message ?? "Invite failed" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
