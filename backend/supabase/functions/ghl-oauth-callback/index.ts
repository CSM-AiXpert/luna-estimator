// ─── GHL OAuth Callback Edge Function ───────────────────────────────────────
// Endpoint: GET /ghl-oauth-callback
// Handles OAuth 2.0 redirect from GHL after user authorizes Luna.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// OAuth token endpoint
const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const locationId = url.searchParams.get('locationId') ?? url.searchParams.get('state');

  if (error) {
    return json({ error: `GHL OAuth error: ${error}` }, 400);
  }

  if (!code) {
    return json({ error: 'Missing authorization code' }, 400);
  }

  const clientId = Deno.env.get('GHL_CLIENT_ID');
  const clientSecret = Deno.env.get('GHL_CLIENT_SECRET');
  const redirectUri = Deno.env.get('GHL_OAUTH_REDIRECT_URI');

  if (!clientId || !clientSecret || !redirectUri) {
    return json({ error: 'GHL OAuth not configured (missing env vars)' }, 500);
  }

  // Exchange code for tokens
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('[ghl-oauth] Token exchange failed:', errText);
    return json({ error: 'Token exchange failed' }, 502);
  }

  const tokens: OAuthTokenResponse = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Upsert integration settings
  const { error: upsertError } = await supabase
    .from('ghl_integration_settings')
    .upsert(
      {
        location_id: locationId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'location_id' }
    );

  if (upsertError) {
    console.error('[ghl-oauth] Failed to save tokens:', upsertError);
    return json({ error: 'Failed to save integration settings' }, 500);
  }

  // Redirect to frontend success page
  const successUrl = `${url.origin}/settings/ghl?connected=true&locationId=${locationId}`;
  return Response.redirect(successUrl, 302);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
