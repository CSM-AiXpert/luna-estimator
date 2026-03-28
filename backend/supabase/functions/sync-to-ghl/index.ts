// ─── GHL Sync Edge Function ───────────────────────────────────────────────────
// Endpoint: POST /sync-to-ghl
// Triggers Luna → GHL sync for a customer / project / estimate.
// Requires Authorization header (JWT). Extracts organizationId from JWT.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  syncCustomerToGHL,
  syncProjectToGHL,
  syncEstimateToGHL,
} from '../../services/ghl/sync-service';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getOrganizationId(
  supabase: SupabaseClient,
  authHeader: string
): Promise<string | null> {
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single();

  return profile?.organization_id ?? null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const organizationId = await getOrganizationId(supabase, authHeader);
  if (!organizationId) return json({ error: 'Could not determine organization' }, 401);

  let body: {
    type: 'customer' | 'project' | 'estimate';
    customerId?: string;
    projectId?: string;
    estimateId?: string;
    lineItems?: Array<Record<string, unknown>>;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { type, customerId, projectId, estimateId } = body;
  const lineItems = body.lineItems ?? [];

  try {
    switch (type) {
      case 'customer': {
        if (!customerId) return json({ error: 'customerId required' }, 400);

        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .eq('organization_id', organizationId)
          .single();

        if (customerError || !customer) return json({ error: 'Customer not found' }, 404);

        const ghlId = await syncCustomerToGHL(
          customer as Record<string, unknown>,
          organizationId,
          customer.ghl_contact_id ?? undefined
        );

        await supabase
          .from('customers')
          .update({ ghl_contact_id: ghlId, updated_at: new Date().toISOString() })
          .eq('id', customerId);

        return json({ success: true, ghlContactId: ghlId });
      }

      case 'project': {
        if (!projectId) return json({ error: 'projectId required' }, 400);

        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('*, customers(ghl_contact_id)')
          .eq('id', projectId)
          .eq('organization_id', organizationId)
          .single();

        if (projectError || !project) return json({ error: 'Project not found' }, 404);

        const ghlContactId = project.customers?.ghl_contact_id;
        if (!ghlContactId) {
          return json({ error: 'Customer has no GHL contact. Sync customer first.' }, 422);
        }

        // Fetch most recent estimate
        const { data: estimate } = await supabase
          .from('estimates')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const ghlOppId = await syncProjectToGHL(
          project as Record<string, unknown>,
          estimate as Record<string, unknown> | null,
          organizationId,
          ghlContactId,
          project.ghl_opportunity_id ?? undefined
        );

        await supabase
          .from('projects')
          .update({ ghl_opportunity_id: ghlOppId, updated_at: new Date().toISOString() })
          .eq('id', projectId);

        return json({ success: true, ghlOpportunityId: ghlOppId });
      }

      case 'estimate': {
        if (!estimateId) return json({ error: 'estimateId required' }, 400);
        if (!projectId) return json({ error: 'projectId required' }, 400);

        const { data: estimate, error: estError } = await supabase
          .from('estimates')
          .select('*')
          .eq('id', estimateId)
          .single();

        if (estError || !estimate) return json({ error: 'Estimate not found' }, 404);

        const { data: project, error: projError } = await supabase
          .from('projects')
          .select('id, ghl_opportunity_id')
          .eq('id', projectId)
          .eq('organization_id', organizationId)
          .single();

        if (projError || !project) return json({ error: 'Project not found' }, 404);
        if (!project.ghl_opportunity_id) {
          return json({ error: 'Project has no GHL opportunity. Sync project first.' }, 422);
        }

        const { data: items } = await supabase
          .from('estimate_line_items')
          .select('*')
          .eq('estimate_id', estimateId);

        await syncEstimateToGHL(
          estimate as Record<string, unknown>,
          project as Record<string, unknown>,
          organizationId,
          project.ghl_opportunity_id,
          (items ?? []) as Array<Record<string, unknown>>
        );

        return json({ success: true });
      }

      default:
        return json({ error: `Unknown type: ${type}` }, 400);
    }
  } catch (err) {
    console.error('[sync-to-ghl] Error:', err);
    return json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
