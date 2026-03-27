// sync-to-ghl/index.ts
// Pushes data to GoHighLevel (contacts, opportunities, estimates)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GHLConfig {
  accessToken: string;
  locationId: string;
  pipelineId: string;
  baseUrl: string;
}

async function getGHLConfig(
  supabase: ReturnType<typeof createClient>,
  organizationId: string
): Promise<GHLConfig | null> {
  const { data: settings } = await supabase
    .from("ghl_integration_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .single();

  if (!settings) return null;

  return {
    accessToken: settings.access_token || Deno.env.get("GHL_PRIVATE_INTEGRATION_TOKEN") || "",
    locationId: settings.location_id,
    pipelineId: settings.pipeline_id || Deno.env.get("GHL_PIPELINE_ID") || "",
    baseUrl: "https://services.leadconnectorhq.com",
  };
}

async function ghlRequest(
  config: GHLConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; data: unknown; status: number }> {
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data, status: response.status };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's organization
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData.user?.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: user } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("id", userId)
      .single();

    if (!user || !["owner", "admin"].includes(user.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = user.organization_id;
    const config = await getGHLConfig(supabase, organizationId);

    if (!config) {
      return new Response(JSON.stringify({ error: "GHL integration not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sync_type, entity_id } = await req.json();

    // Create sync job record
    const { data: syncJob, error: jobError } = await supabase
      .from("ghl_sync_jobs")
      .insert({
        organization_id: organizationId,
        sync_type: sync_type || "push_contact",
        status: "processing",
      })
      .select()
      .single();

    if (jobError) {
      return new Response(JSON.stringify({ error: "Failed to create sync job" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result = { success: false, records_synced: 0 };
    let ghlResponse: Record<string, unknown> = {};
    let errorMessage: string | null = null;

    try {
      switch (sync_type) {
        case "push_contact":
        case "push_contacts": {
          // Get customers that have GHL contact IDs or need syncing
          const { data: customers, error: custError } = await supabase
            .from("customers")
            .select("*")
            .eq("organization_id", organizationId)
            .limit(50);

          if (custError) throw custError;

          let synced = 0;
          for (const customer of customers || []) {
            const contactPayload: Record<string, unknown> = {
              firstName: customer.first_name,
              lastName: customer.last_name,
              email: customer.email,
              phone: customer.phone,
              companyName: customer.company_name,
              address1: customer.address_line1,
              address2: customer.address_line2,
              city: customer.city,
              state: customer.state,
              postalCode: customer.postal_code,
              country: customer.country,
              locationId: config.locationId,
            };

            if (customer.ghl_contact_id) {
              // Update existing contact
              const res = await ghlRequest(
                config,
                "PUT",
                `/contacts/${customer.ghl_contact_id}`,
                contactPayload
              );
              if (res.ok) synced++;
            } else {
              // Create new contact
              const res = await ghlRequest(config, "POST", "/contacts", contactPayload);
              if (res.ok && res.data && typeof res.data === "object" && "id" in res.data) {
                // Update customer with GHL contact ID
                await supabase
                  .from("customers")
                  .update({ ghl_contact_id: (res.data as { id: string }).id })
                  .eq("id", customer.id);
                synced++;
              }
            }
          }
          result = { success: true, records_synced: synced };
          ghlResponse = { synced_count: synced };
          break;
        }

        case "push_opportunity": {
          if (!entity_id) throw new Error("entity_id required for push_opportunity");

          const { data: project, error: projError } = await supabase
            .from("projects")
            .select("*, customers(*)")
            .eq("id", entity_id)
            .single();

          if (projError || !project) throw new Error("Project not found");

          // Get customer GHL contact ID
          const ghlContactId = project.customers?.ghl_contact_id;
          if (!ghlContactId) throw new Error("Customer does not have a GHL contact ID");

          const opportunityPayload: Record<string, unknown> = {
            name: project.name,
            contactId: ghlContactId,
            locationId: config.locationId,
            pipelineId: config.pipelineId,
            status: mapStatusToGHLStage(project.status),
            address: project.address,
            city: project.city,
            state: project.state,
            postalCode: project.postal_code,
          };

          if (project.ghl_opportunity_id) {
            const res = await ghlRequest(
              config,
              "PUT",
              `/opportunities/${project.ghl_opportunity_id}`,
              opportunityPayload
            );
            ghlResponse = res.data as Record<string, unknown>;
            if (!res.ok) errorMessage = JSON.stringify(res.data);
          } else {
            const res = await ghlRequest(config, "POST", "/opportunities", opportunityPayload);
            ghlResponse = res.data as Record<string, unknown>;
            if (res.ok && typeof res.data === "object" && res.data && "id" in res.data) {
              await supabase
                .from("projects")
                .update({ ghl_opportunity_id: (res.data as { id: string }).id })
                .eq("id", project.id);
            } else {
              errorMessage = JSON.stringify(res.data);
            }
          }
          result = { success: !!ghlResponse && !errorMessage, records_synced: 1 };
          break;
        }

        case "push_estimate": {
          if (!entity_id) throw new Error("entity_id required for push_estimate");

          const { data: estimate, error: estError } = await supabase
            .from("estimates")
            .select("*, projects(*)")
            .eq("id", entity_id)
            .single();

          if (estError || !estimate) throw new Error("Estimate not found");

          // Get estimate items
          const { data: items } = await supabase
            .from("estimate_items")
            .select("*")
            .eq("estimate_id", entity_id);

          // Push as a note/estimate on the GHL opportunity
          if (!estimate.projects?.ghl_opportunity_id) {
            throw new Error("Project does not have a GHL opportunity ID");
          }

          const lineItems = (items || [])
            .map(
              (item) =>
                `• ${item.description}: ${item.quantity} ${item.unit} @ $${item.unit_cost} = $${item.total_cost}`
            )
            .join("\n");

          const noteContent = `ESTIMATE v${estimate.version} - ${estimate.status.toUpperCase()}
Total: $${estimate.total}
Valid Until: ${estimate.valid_until || "N/A"}
---
${lineItems}
${estimate.notes ? `\nNotes: ${estimate.notes}` : ""}`;

          const noteRes = await ghlRequest(config, "POST", "/notes", {
            contactId: estimate.projects.customers?.ghl_contact_id,
            opportunityId: estimate.projects.ghl_opportunity_id,
            body: noteContent,
            type: "estimate",
          });

          result = { success: noteRes.ok, records_synced: noteRes.ok ? 1 : 0 };
          ghlResponse = noteRes.data as Record<string, unknown>;
          if (!noteRes.ok) errorMessage = JSON.stringify(noteRes.data);
          break;
        }

        default:
          throw new Error(`Unknown sync_type: ${sync_type}`);
      }
    } catch (fnError) {
      errorMessage = (fnError as Error).message;
      result = { success: false, records_synced: 0 };
    }

    // Update sync job
    await supabase
      .from("ghl_sync_jobs")
      .update({
        status: errorMessage ? "failed" : "completed",
        ghl_response: ghlResponse,
        error_message: errorMessage,
        records_synced: result.records_synced,
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncJob.id);

    return new Response(
      JSON.stringify({
        success: result.success,
        sync_job_id: syncJob.id,
        records_synced: result.records_synced,
        ghl_response: ghlResponse,
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-to-ghl:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapStatusToGHLStage(status: string): string {
  const map: Record<string, string> = {
    lead: "New Lead",
    bid: "Proposal Sent",
    active: "Job In Progress",
    completed: "Won - Completed",
    cancelled: "Lost",
  };
  return map[status] || "New Lead";
}
