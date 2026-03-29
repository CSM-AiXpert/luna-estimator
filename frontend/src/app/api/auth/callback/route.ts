import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { Database } from "@/lib/supabase/types"

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)

  // Create browser client to handle the callback
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll().map(c => ({ name: c.name, value: c.value })) },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              req.cookies.set(name, value)
            )
          } catch { /* ignore */ }
        },
      },
    }
  )

  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") ?? "/"

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)

    // After successful auth, create org if metadata was set
    // @ts-ignore
    const { data: { user } } = await supabase.auth.getUser()
    // @ts-ignore
    const orgName = user?.user_metadata?.org_name
    // @ts-ignore
    const fullName = user?.user_metadata?.full_name

    if (orgName && user) {
      // Create org + profile using service role
      const { createClient } = await import("@supabase/supabase-js")
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // @ts-ignore
      const { data: org, error: orgError } = await (serviceClient
        .from("organizations") as any)
        .insert({ name: orgName })
        .select()
        .single()

      if (!orgError && org) {
        // @ts-ignore
        await (serviceClient.from("users") as any).insert({
          id: user.id,
          organization_id: org.id,
          role: "owner",
          full_name: fullName,
          email: user.email,
        })
      }
    }
  }

  // Redirect to app
  return NextResponse.redirect(new URL(next, requestUrl.origin).toString(), { status: 303 })
}
