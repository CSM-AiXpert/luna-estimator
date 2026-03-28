// ─── GHL OAuth Token Refresh Utility ─────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { GHLClient } from './ghl-client';

const TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function refreshGhlToken(
  refreshToken: string
): Promise<TokenResponse> {
  const clientId = Deno.env.get('GHL_CLIENT_ID') ?? process.env.GHL_CLIENT_ID;
  const clientSecret = Deno.env.get('GHL_CLIENT_SECRET') ?? process.env.GHL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GHL OAuth credentials not configured');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL token refresh failed: ${err}`);
  }

  return res.json();
}

/**
 * Get a valid GHL client, refreshing the token if needed.
 * Reads settings from Supabase and updates the access token if it changed.
 */
export async function getGhlClient(
  supabase: ReturnType<typeof createClient>
): Promise<GHLClient> {
  const { data: settings, error } = await supabase
    .from('ghl_integration_settings')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error || !settings) {
    throw new Error('GHL integration not configured');
  }

  const client = new GHLClient(settings.access_token, settings.location_id);

  // Check if token is about to expire (within 5 minutes)
  const expiresAt = new Date(settings.expires_at).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiresAt - now < fiveMinutes && settings.refresh_token) {
    const tokens = await refreshGhlToken(settings.refresh_token);
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase
      .from('ghl_integration_settings')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('location_id', settings.location_id);

    client.setAccessToken(tokens.access_token);
  }

  return client;
}
