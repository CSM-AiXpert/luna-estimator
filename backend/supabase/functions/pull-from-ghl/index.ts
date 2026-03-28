// ─── Pull From GHL Edge Function ─────────────────────────────────────────────
// Endpoint: POST /pull-from-ghl
// Triggers a GHL → Luna sync (pull contacts and/or opportunities).

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  pullContactsFromGHL,
  pullOpportunitiesFromGHL,
} from '../../services/ghl/sync-service';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const organizationId = await getOrganizationId(supabase, authHeader);
  if (!organizationId) return json({ error: 'Could not determine organization' }, 401);

  let body: { type?: 'contacts' | 'opportunities' | 'all' } = {};
  try {
    body = await req.json();
  } catch {
    // default: all
  }

  const syncType = body.type ?? 'all';
  const results: Record<string, unknown> = {};

  try {
    if (syncType === 'contacts' || syncType === 'all') {
      results.contacts = await pullContactsFromGHL(organizationId);
    }
    if (syncType === 'opportunities' || syncType === 'all') {
      results.opportunities = await pullOpportunitiesFromGHL(organizationId);
    }
    return json({ success: true, results });
  } catch (err) {
    console.error('[pull-from-ghl] Error:', err);
    return json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
