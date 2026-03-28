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

// POST /api/ghl-settings/sync
// Creates a GHL sync job to pull contacts/opportunities
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    const uid = (user as any)?.id
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await (supabase.from("users") as any)
        .select("organization_id").eq("id", uid).single()
    if (!(profile as any)?.organization_id) return NextResponse.json({ error: "No organization" }, { status: 400 })

    const { data: settings } = await supabase
      .from("ghl_integration_settings")
      .select("is_active, access_token, location_id")
      .eq("organization_id", (profile as any)?.organization_id)
      .maybeSingle()

    if (!settings?.is_active || !settings?.access_token) {
      return NextResponse.json({ error: "GHL not connected" }, { status: 400 })
    }

    // Create a sync job record
    const { data: job, error } = await supabase
      .from("ghl_sync_jobs")
      .insert({
        organization_id: (profile as any)?.organization_id,
        sync_type: "full",
        status: "pending",
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // TODO: In production, trigger a Supabase Edge Function or cron job to
    // process this sync job (similar to file processing dispatch)
    // For now, we do a basic sync: fetch contacts + opportunities from GHL

    try {
      // Fetch contacts from GHL
      const contactsRes = await fetch(
        "https://services.leadconnectorhq.com/contacts/?locationId=" + settings.location_id,
        {
          headers: {
            Authorization: `Bearer ${settings.access_token}`,
            "Content-Type": "application/json",
            Version: "2021-07-28",
          },
        }
      )

      let recordsSynced = 0
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json()
        const contacts = contactsData.contacts ?? []

        for (const contact of contacts.slice(0, 50)) {
          const { error: upsertError } = await supabase
            .from("customers")
            .upsert({
              organization_id: (profile as any)?.organization_id,
              ghl_contact_id: contact.id,
              first_name: contact.firstName ?? contact.name?.split(" ")[0] ?? "Unknown",
              last_name: contact.lastName ?? contact.name?.split(" ").slice(1).join(" ") ?? "—",
              email: contact.email ?? null,
              phone: contact.phone ?? null,
              company_name: contact.companyName ?? null,
            }, { onConflict: "ghl_contact_id" })

          if (!upsertError) recordsSynced++
        }
      }

      // Update job status
      await supabase
        .from("ghl_sync_jobs")
        .update({ status: "completed", records_synced: recordsSynced, completed_at: new Date().toISOString() })
        .eq("id", job.id)

      return NextResponse.json({ success: true, records_synced: recordsSynced })
    } catch {
      await supabase
        .from("ghl_sync_jobs")
        .update({ status: "failed", error_message: "Sync failed" })
        .eq("id", job.id)
      return NextResponse.json({ error: "Sync failed" }, { status: 500 })
    }
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
