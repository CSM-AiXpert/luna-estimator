// ghl-webhook/index.ts
// Receives inbound GoHighLevel webhooks

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function verifyGHLWebhook(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  try {
    const expectedSig = createHmac("sha256", secret).update(body).digest("hex");
    return expectedSig === signature;
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("NEXT_PUBLIC_SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("GHL_WEBHOOK_SECRET") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.text();
    const signature = req.headers.get("x-ghl-signature") || "";

    // Verify webhook signature
    if (webhookSecret && !verifyGHLWebhook(rawBody, signature, webhookSecret)) {
      console.warn("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload.type || payload.event || "unknown";
    const locationId = payload.location_id || payload.locationId || "";

    // Find organization by GHL location ID
    const { data: ghlSettings, error: settingsError } = await supabase
      .from("ghl_integration_settings")
      .select("organization_id, is_active")
      .eq("location_id", locationId)
      .eq("is_active", true)
      .single();

    if (settingsError || !ghlSettings) {
      // Log the event anyway but don't process
      console.log(`Webhook received for unknown location: ${locationId}`);
      return new Response(JSON.stringify({ received: true, processed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = ghlSettings.organization_id;

    // Store webhook event
    const { data: webhookEvent, error: eventError } = await supabase
      .from("webhook_events")
      .insert({
        organization_id: organizationId,
        source: "ghl",
        event_type: eventType,
        payload: payload,
        processed: false,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Error storing webhook event:", eventError);
    }

    // Process based on event type
    try {
      switch (eventType) {
        case "Contact.create":
        case "Contact.update":
          await handleContactUpsert(supabase, organizationId, payload);
          break;

        case "Opportunity.create":
        case "Opportunity.update":
          await handleOpportunityUpsert(supabase, organizationId, payload);
          break;

        case "Opportunity.stageChange":
          await handleOpportunityStageChange(supabase, organizationId, payload);
          break;

        case "Note.create":
          await handleNoteCreate(supabase, organizationId, payload);
          break;

        default:
          console.log(`Unhandled webhook event type: ${eventType}`);
      }

      // Mark event as processed
      if (webhookEvent) {
        await supabase
          .from("webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", webhookEvent.id);
      }
    } catch (processError) {
      console.error("Error processing webhook:", processError);

      if (webhookEvent) {
        await supabase
          .from("webhook_events")
          .update({
            processed: false,
            error: processError.message,
            processed_at: new Date().toISOString(),
          })
          .eq("id", webhookEvent.id);
      }
    }

    return new Response(
      JSON.stringify({ received: true, processed: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ghl-webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleContactUpsert(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  payload: Record<string, unknown>
) {
  const contact = payload.contact || payload.data || payload;
  if (!contact) return;

  const ghlContactId = contact.id as string;
  const firstName = (contact.first_name || contact.firstName || "") as string;
  const lastName = (contact.last_name || contact.lastName || "") as string;
  const email = (contact.email || "") as string;
  const phone = (contact.phone || contact.phone_number || "") as string;
  const companyName = (contact.company_name || contact.companyName || "") as string;
  const address1 = (contact.address1 || contact.address_line_1 || "") as string;
  const address2 = (contact.address2 || contact.address_line_2 || "") as string;
  const city = (contact.city || "") as string;
  const state = (contact.state || "") as string;
  const postalCode = (contact.postal_code || contact.zip || "") as string;
  const country = (contact.country || "US") as string;

  // Check if customer already exists
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("ghl_contact_id", ghlContactId)
    .single();

  if (existing) {
    // Update existing customer
    await supabase
      .from("customers")
      .update({
        first_name: firstName,
        last_name: lastName,
        email: email || null,
        phone: phone || null,
        company_name: companyName || null,
        address_line1: address1 || null,
        address_line2: address2 || null,
        city: city || null,
        state: state || null,
        postal_code: postalCode || null,
        country: country || "US",
      })
      .eq("id", existing.id);
  } else {
    // Create new customer
    await supabase.from("customers").insert({
      organization_id: organizationId,
      ghl_contact_id: ghlContactId,
      first_name: firstName || "Unknown",
      last_name: lastName || "",
      email: email || null,
      phone: phone || null,
      company_name: companyName || null,
      address_line1: address1 || null,
      address_line2: address2 || null,
      city: city || null,
      state: state || null,
      postal_code: postalCode || null,
      country: country || "US",
    });
  }
}

async function handleOpportunityUpsert(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  payload: Record<string, unknown>
) {
  const opportunity = payload.opportunity || payload.data || payload;
  if (!opportunity) return;

  const ghlOpportunityId = opportunity.id as string;
  const name = (opportunity.name || opportunity.title || "Untitled Project") as string;
  const status = mapGHLStageToStatus(opportunity.stage_id || opportunity.pipeline_id || "");
  const address = (opportunity.address || opportunity.location || "") as string;
  const city = (opportunity.city || "") as string;
  const state = (opportunity.state || "") as string;
  const postalCode = (opportunity.postal_code || opportunity.zip || "") as string;

  // Contact/customer ID from GHL
  const ghlContactId = opportunity.contact_id || opportunity.contactId || "";

  // Find customer by ghl_contact_id
  let customerId: string | null = null;
  if (ghlContactId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("ghl_contact_id", ghlContactId)
      .single();
    customerId = customer?.id || null;
  }

  // Check if project already exists
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("ghl_opportunity_id", ghlOpportunityId)
    .single();

  if (existing) {
    await supabase.from("projects").update({
      name,
      status,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      postal_code: postalCode || undefined,
      ghl_opportunity_id: ghlOpportunityId,
    }).eq("id", existing.id);
  } else if (customerId) {
    // Create new project only if we have a customer
    await supabase.from("projects").insert({
      organization_id: organizationId,
      customer_id: customerId,
      ghl_opportunity_id: ghlOpportunityId,
      name,
      status,
      address: address || "",
      city: city || "",
      state: state || "",
      postal_code: postalCode || "",
    });
  }
}

async function handleOpportunityStageChange(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  payload: Record<string, unknown>
) {
  // Same as upsert but specifically updates the status
  await handleOpportunityUpsert(supabase, organizationId, payload);
}

async function handleNoteCreate(
  supabase: ReturnType<typeof createClient>,
  _organizationId: string,
  _payload: Record<string, unknown>
) {
  // Future: could append notes to project record or create an activity log entry
  console.log("Note create webhook received (not yet implemented)");
}

function mapGHLStageToStatus(_stageId: string): "lead" | "bid" | "active" | "completed" | "cancelled" {
  // In a full implementation, you'd look up the GHL pipeline stage name
  // and map it to our project status enum
  return "lead";
}
