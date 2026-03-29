import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseServiceClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, fullName, orgName } = body

    if (!email || !password || !fullName || !orgName) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Create auth user via admin API
    // @ts-ignore
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        org_name: orgName,
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? "Auth failed" }, { status: 400 })
    }

    const uid = authData.user.id

    // 2. Create organization
    // @ts-ignore
    const { data: org, error: orgError } = await (supabase
      .from("organizations") as any)
      .insert({ name: orgName })
      .select()
      .single()

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 400 })
    }

    // 3. Create user profile (service role bypasses RLS)
    // @ts-ignore
    const { error: profileError } = await (supabase
      .from("users") as any)
      .insert({
        id: uid,
        organization_id: org.id,
        role: "owner",
        full_name: fullName,
        email,
      })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: authData.user }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
