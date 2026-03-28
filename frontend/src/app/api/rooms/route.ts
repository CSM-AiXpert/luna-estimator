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

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    // @ts-ignore
    const { data: { user } } = await supabase.auth.getUser()
    // @ts-ignore
    const uid = (user as any)?.id
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const include = searchParams.get("include")

    let query = supabase
      .from("rooms")
      .select(`
        id,
        name,
        room_type,
        status,
        total_sqft,
        updated_at,
        project:projects(
          id,
          name,
          status,
          customer:customers(first_name, last_name)
        )
      `)
      .order("updated_at", { ascending: false })

    // @ts-ignore
    const { data: rooms, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(rooms ?? [])
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
