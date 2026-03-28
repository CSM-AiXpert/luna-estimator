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
          catch { /* Server Component — ignore */ }
        },
      },
    }
  )
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: customers, error } = await supabase
      .from("customers")
      .select("*, projects(id, name, status)")
      .order("created_at", { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(customers ?? [])
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const body = await req.json()
    const { data: customer, error } = await supabase
      .from("customers")
      .insert(body)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(customer, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
