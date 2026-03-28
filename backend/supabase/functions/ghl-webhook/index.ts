// ─── GHL Webhook Edge Function ──────────────────────────────────────────────
// Endpoint: POST /ghl-webhook
// Handles inbound GHL webhooks: contact.create, contact.update,
// opportunity.create, opportunity.update, opportunity.stage_update

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import type { GHLWebhookPayload } from '../../services/ghl/ghl-types';
import { processWebhookEvent } from '../../services/ghl/sync-service';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GHL_WEBHOOK_SECRET = Deno.env.get('GHL_WEBHOOK_SECRET');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_EVENTS = [
  'contact.create',
  'contact.update',
  'contact.delete',
  'opportunity.create',
  'opportunity.update',
  'opportunity.stage_update',
  'opportunity.delete',
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  // ── 1. Verify Signature ───────────────────────────────────────────────────

  const rawBody = await req.text();
  const signature = req.headers.get('x-hook-secret');

  if (GHL_WEBHOOK_SECRET && signature) {
    const expected = createHmac('sha256', GHL_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    if (signature !== expected) {
      console.warn('[ghl-webhook] Invalid signature — rejecting');
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  // ── 2. Parse Payload ─────────────────────────────────────────────────────

  let event: GHLWebhookPayload;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!event.event || !VALID_EVENTS.includes(event.event)) {
    return json({ error: `Unknown event: ${event.event}` }, 400);
  }

  const locationId = event.locationId;
  if (!locationId) {
    return json({ error: 'Missing locationId in payload' }, 400);
  }

  // ── 3. Quick Acknowledge ─────────────────────────────────────────────────

  // Respond immediately so GHL doesn't retry
  const ackResponse = json({ received: true }, 200);

  // ── 4. Resolve organizationId from locationId ────────────────────────────

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Look up the organization that owns this GHL location
  const { data: settings, error: settingsError } = await supabase
    .from('ghl_integration_settings')
    .select('organization_id')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .maybeSingle();

  if (settingsError || !settings) {
    console.error('[ghl-webhook] No active integration for location:', locationId);
    return ackResponse;
  }

  const organizationId = settings.organization_id;

  // ── 5. Store raw event ────────────────────────────────────────────────────

  const { error: insertError } = await supabase.from('webhook_events').insert({
    organization_id: organizationId,
    source: 'ghl',
    event_type: event.event,
    payload: event as unknown,
    processed: false,
  });

  if (insertError) {
    console.error('[ghl-webhook] Failed to store event:', insertError);
  }

  // ── 6. Async Processing ───────────────────────────────────────────────────

  processWebhookEvent(event, organizationId, supabase).catch((err) => {
    console.error('[ghl-webhook] Processing error:', err);
  });

  return ackResponse;
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
