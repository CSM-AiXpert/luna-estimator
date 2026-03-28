// ─── GHL Bi-directional Sync Service ───────────────────────────────────────
// Aligned with Luna DB schema: ghl_integration_settings, ghl_sync_jobs,
// webhook_events, customers, projects tables.

import { createClient } from '@supabase/supabase-js';
import { GHLClient } from './ghl-client';
import type { GHLContact, GHLOpportunity, GHLWebhookPayload } from './ghl-types';
import {
  lunaCustomerToGhlContact,
  ghlContactToLunaCustomer,
  lunaProjectToGhlOpportunity,
  lunaProjectToGhlOpportunityUpdate,
  lunaEstimateToGhlNoteBody,
  mapGhlStatusToLuna,
} from './field-mappings';

// ─── Supabase ───────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? Deno.env.get('SUPABASE_URL')!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Integration Settings (per-organization) ────────────────────────────────

interface GhlSettings {
  organization_id: string;
  location_id: string;
  pipeline_id: string;
  default_stage_id: string;
  access_token: string;
  webhook_secret?: string;
}

async function loadSettings(
  supabase: ReturnType<typeof createClient>,
  organizationId: string
): Promise<GhlSettings | null> {
  const { data, error } = await supabase
    .from('ghl_integration_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return data as GhlSettings;
}

// ─── Log helpers ────────────────────────────────────────────────────────────

async function logSyncJob(params: {
  supabase: ReturnType<typeof createClient>;
  organizationId: string;
  syncType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  ghlResponse?: unknown;
  errorMessage?: string;
  recordsSynced?: number;
}): Promise<void> {
  const { supabase, organizationId, ...rest } = params;
  try {
    await supabase.from('ghl_sync_jobs').insert({
      organization_id: organizationId,
      sync_type: rest.syncType,
      status: rest.status,
      ghl_response: rest.ghlResponse,
      error_message: rest.errorMessage,
      records_synced: rest.recordsSynced ?? 0,
    });
  } catch (err) {
    console.error('[ghl-sync] Failed to log sync job:', err);
  }
}

async function logWebhookEvent(params: {
  supabase: ReturnType<typeof createClient>;
  organizationId: string;
  eventType: string;
  payload: unknown;
}): Promise<void> {
  const { supabase, organizationId, eventType, payload } = params;
  try {
    await supabase.from('webhook_events').insert({
      organization_id: organizationId,
      source: 'ghl',
      event_type: eventType,
      payload,
      processed: false,
    });
  } catch (err) {
    console.error('[ghl-webhook] Failed to log event:', err);
  }
}

// ─── Stage Resolver (using default_stage_id from settings) ─────────────────

function resolveStageId(
  status: string,
  settings: GhlSettings,
  _projectStatuses: Record<string, string> = {}
): string {
  // Map Luna statuses to GHL stages
  // In a full implementation these would be stored in ghl_integration_settings
  // as JSONB field_mappings. Here we use the single default_stage_id as fallback.
  const statusStageMap: Record<string, string> = {
    lead: settings.default_stage_id,
    bid: settings.default_stage_id,
    active: settings.default_stage_id,
    completed: settings.default_stage_id,
  };
  return statusStageMap[status] ?? settings.default_stage_id;
}

// ─── PUSH: Luna → GHL ───────────────────────────────────────────────────────

/**
 * Sync a Luna customer to GHL. Creates or updates the GHL contact.
 * Returns the GHL contact ID.
 */
export async function syncCustomerToGHL(
  customer: Record<string, unknown>,
  organizationId: string,
  ghlContactId?: string
): Promise<string> {
  const supabase = getSupabase();
  const settings = await loadSettings(supabase, organizationId);
  if (!settings) throw new Error('GHL integration not configured for this organization');

  const client = new GHLClient(settings.access_token, settings.location_id);
  const ghlPayload = lunaCustomerToGhlContact(customer, settings.location_id);
  const tags = [...new Set([...(ghlPayload.tags ?? []), 'luna-customer'])];

  let result: GHLContact;
  let status: 'completed' | 'failed' = 'completed';
  let errorMessage: string | undefined;

  await logSyncJob({ supabase, organizationId, syncType: 'contact_push', status: 'processing' });

  try {
    if (ghlContactId) {
      result = await client.updateContact(ghlContactId, { ...ghlPayload, tags });
    } else {
      result = await client.createContact({ ...ghlPayload, tags });
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
    await logSyncJob({
      supabase,
      organizationId,
      syncType: 'contact_push',
      status: 'failed',
      errorMessage,
      ghlResponse: { contactId: ghlContactId },
    });
    throw err;
  }

  await logSyncJob({
    supabase,
    organizationId,
    syncType: 'contact_push',
    status,
    ghlResponse: { contactId: result.id },
    recordsSynced: 1,
  });

  return result.id;
}

/**
 * Sync a Luna project to GHL as an Opportunity.
 */
export async function syncProjectToGHL(
  project: Record<string, unknown>,
  estimate: Record<string, unknown> | null,
  organizationId: string,
  ghlContactId: string,
  ghlOpportunityId?: string
): Promise<string> {
  const supabase = getSupabase();
  const settings = await loadSettings(supabase, organizationId);
  if (!settings) throw new Error('GHL integration not configured for this organization');

  const client = new GHLClient(settings.access_token, settings.location_id);
  const stageId = resolveStageId(project.status as string, settings);

  const ghlPayload = lunaProjectToGhlOpportunity(
    project,
    estimate,
    settings.location_id,
    settings.pipeline_id,
    stageId,
    ghlContactId
  );

  let result: GHLOpportunity;
  let status: 'completed' | 'failed' = 'completed';
  let errorMessage: string | undefined;

  await logSyncJob({ supabase, organizationId, syncType: 'opportunity_push', status: 'processing' });

  try {
    if (ghlOpportunityId) {
      const updateData = lunaProjectToGhlOpportunityUpdate(project, estimate);
      result = await client.updateOpportunity(ghlOpportunityId, {
        id: ghlOpportunityId,
        ...updateData,
        pipelineStageId: stageId,
      });
    } else {
      result = await client.createOpportunity(ghlPayload);
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
    await logSyncJob({
      supabase,
      organizationId,
      syncType: 'opportunity_push',
      status: 'failed',
      errorMessage,
    });
    throw err;
  }

  await logSyncJob({
    supabase,
    organizationId,
    syncType: 'opportunity_push',
    status,
    ghlResponse: { opportunityId: result.id },
    recordsSynced: 1,
  });

  return result.id;
}

/**
 * Sync estimate details to GHL: update opportunity value + add line-item note.
 */
export async function syncEstimateToGHL(
  estimate: Record<string, unknown>,
  project: Record<string, unknown>,
  organizationId: string,
  ghlOpportunityId: string,
  lineItems: Array<Record<string, unknown>>
): Promise<void> {
  const supabase = getSupabase();
  const settings = await loadSettings(supabase, organizationId);
  if (!settings) throw new Error('GHL integration not configured for this organization');

  const client = new GHLClient(settings.access_token, settings.location_id);
  const stageId = resolveStageId(estimate.status as string, settings);

  await logSyncJob({ supabase, organizationId, syncType: 'estimate_push', status: 'processing' });

  try {
    await client.updateOpportunity(ghlOpportunityId, {
      id: ghlOpportunityId,
      maxVal: estimate.total as number,
      monetaryValue: estimate.total as number,
      pipelineStageId: stageId,
    });

    const noteBody = lunaEstimateToGhlNoteBody(estimate, lineItems);
    await client.addNoteToOpportunity(ghlOpportunityId, {
      body: noteBody,
      type: 'Log',
    });

    await logSyncJob({
      supabase,
      organizationId,
      syncType: 'estimate_push',
      status: 'completed',
      ghlResponse: { noteAdded: true },
      recordsSynced: 1,
    });
  } catch (err) {
    await logSyncJob({
      supabase,
      organizationId,
      syncType: 'estimate_push',
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ─── PULL: GHL → Luna ───────────────────────────────────────────────────────

/**
 * Pull all contacts from GHL and upsert into Luna customers.
 */
export async function pullContactsFromGHL(
  organizationId: string
): Promise<{ created: number; updated: number }> {
  const supabase = getSupabase();
  const settings = await loadSettings(supabase, organizationId);
  if (!settings) throw new Error('GHL integration not configured for this organization');

  const client = new GHLClient(settings.access_token, settings.location_id);
  let created = 0;
  let updated = 0;
  let page = 0;
  const pageLimit = 100;

  await logSyncJob({ supabase, organizationId, syncType: 'contact_pull', status: 'processing' });

  while (true) {
    const res = await client.getContacts({
      locationId: settings.location_id,
      limit: pageLimit,
      skip: page * pageLimit,
    });

    for (const ghl of res.results) {
      if (!ghl.email) continue;

      const lunaData = ghlContactToLunaCustomer(ghl);

      // Check if already linked by GHL contact ID
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('ghl_contact_id', ghl.id)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('customers')
          .update({ ...lunaData, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        updated++;
      } else {
        // Match by email within the same org
        const { data: byEmail } = await supabase
          .from('customers')
          .select('id')
          .eq('email', ghl.email)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (byEmail) {
          await supabase
            .from('customers')
            .update({ ...lunaData, ghl_contact_id: ghl.id, updated_at: new Date().toISOString() })
            .eq('id', byEmail.id);
          updated++;
        } else {
          await supabase.from('customers').insert({
            ...lunaData,
            organization_id: organizationId,
          });
          created++;
        }
      }
    }

    if (res.results.length < pageLimit) break;
    page++;
  }

  await logSyncJob({
    supabase,
    organizationId,
    syncType: 'contact_pull',
    status: 'completed',
    recordsSynced: created + updated,
  });

  return { created, updated };
}

/**
 * Pull opportunities from GHL and sync stage/status back to Luna projects.
 */
export async function pullOpportunitiesFromGHL(
  organizationId: string
): Promise<{ matched: number }> {
  const supabase = getSupabase();
  const settings = await loadSettings(supabase, organizationId);
  if (!settings) throw new Error('GHL integration not configured for this organization');

  const client = new GHLClient(settings.access_token, settings.location_id);
  const res = await client.getOpportunities(settings.pipeline_id);
  let matched = 0;

  await logSyncJob({ supabase, organizationId, syncType: 'opportunity_pull', status: 'processing' });

  for (const ghl of res.results) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, status')
      .eq('ghl_opportunity_id', ghl.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!project) continue;

    const lunaStatus = mapGhlStatusToLuna(ghl.status);

    await supabase
      .from('projects')
      .update({
        status: lunaStatus as any,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    matched++;
  }

  await logSyncJob({
    supabase,
    organizationId,
    syncType: 'opportunity_pull',
    status: 'completed',
    recordsSynced: matched,
  });

  return { matched };
}

// ─── Webhook Processing ─────────────────────────────────────────────────────

/**
 * Process an inbound GHL webhook event (async, called after quick ack).
 */
export async function processWebhookEvent(
  event: GHLWebhookPayload,
  organizationId: string,
  supabase?: ReturnType<typeof createClient>
): Promise<void> {
  const db = supabase ?? getSupabase();

  // Mark any unprocessed events for this contact/opportunity as stale
  await db
    .from('webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .eq('source', 'ghl')
    .eq('event_type', event.event)
    .eq('processed', false)
    .is('processed_at', null);

  const settings = await loadSettings(db, organizationId);
  if (!settings) {
    console.error('[ghl-webhook] No active GHL integration for org', organizationId);
    return;
  }

  try {
    switch (event.event) {
      case 'contact.create':
      case 'contact.update': {
        const contact = event.data as GHLContact;
        if (!contact?.email) break;

        const lunaData = ghlContactToLunaCustomer(contact);

        const { data: existing } = await db
          .from('customers')
          .select('id')
          .eq('email', contact.email)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (existing) {
          await db
            .from('customers')
            .update({ ...lunaData, ghl_contact_id: contact.id, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else if (event.event === 'contact.create') {
          await db.from('customers').insert({
            ...lunaData,
            organization_id: organizationId,
          });
        }
        break;
      }

      case 'opportunity.create':
      case 'opportunity.update':
      case 'opportunity.stage_update': {
        const opp = event.data as GHLOpportunity;
        if (!opp?.contactId) break;

        const { data: customer } = await db
          .from('customers')
          .select('id')
          .eq('ghl_contact_id', opp.contactId)
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (!customer) break;

        const { data: project } = await db
          .from('projects')
          .select('id, status')
          .eq('customer_id', customer.id)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!project) break;

        const lunaStatus = mapGhlStatusToLuna(opp.status);

        await db
          .from('projects')
          .update({
            status: lunaStatus as any,
            ghl_opportunity_id: opp.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', project.id);
        break;
      }
    }
  } catch (err) {
    console.error('[ghl-webhook] Processing error:', err);
    await db
      .from('webhook_events')
      .update({ error: err instanceof Error ? err.message : String(err) })
      .eq('organization_id', organizationId)
      .eq('source', 'ghl')
      .eq('event_type', event.event)
      .eq('processed', false);
  }
}
