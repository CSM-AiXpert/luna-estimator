import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/lib/supabase/types"
import { createClient as createSupabaseServiceClient } from "@supabase/supabase-js"

function getServiceClient() {
  return createSupabaseServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getUserClient(req: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(c => ({ name: c.name, value: c.value }))
        },
        setAll() { /* read-only for GETs */ },
      },
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name } = body

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Organization name required" }, { status: 400 })
    }

    // Get auth header — if present, link org to user
    const authHeader = req.headers.get("Authorization") ?? ""
    const token = authHeader.replace("Bearer ", "")
    let uid: string | null = null

    if (token) {
      const userClient = getUserClient(req)
      // @ts-ignore
      const { data: { user } } = await userClient.auth.getUser()
      // @ts-ignore
      uid = (user as any)?.id ?? null
    }

    const supabase = getServiceClient()

    // Create organization
    // @ts-ignore
    const { data: org, error: orgError } = await (supabase
      .from("organizations") as any)
      .insert({ name })
      .select()
      .single()

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 400 })
    }

    // If user is authenticated, create their profile
    if (uid) {
      // @ts-ignore
      const { data: { user } } = await userClient.auth.getUser()
      // @ts-ignore
      await (supabase.from("users") as any).insert({
        id: uid,
        organization_id: org.id,
        role: "owner",
        full_name: (user as any)?.user_metadata?.full_name ?? null,
        email: (user as any)?.email ?? null,
      })
    }

    return NextResponse.json({ organization: org }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const userClient = getUserClient(req)
    // @ts-ignore
    const { data: { user } } = await userClient.auth.getUser()
    // @ts-ignore
    const uid = (user as any)?.id
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // @ts-ignore
    const { data: profile } = await (userClient.from("users") as any)
      .select("organization_id").eq("id", uid).single()
    const orgId = (profile as any)?.organization_id
    if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 })

    const supabase = getServiceClient()
    // @ts-ignore
    const { data: org, error } = await (supabase.from("organizations") as any)
      .select("*").eq("id", orgId).single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ organization: org })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
