import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.replace(/\/rest\/v1\/?$/, '');
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function signInWithSupabaseEmail(email: string) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const redirectTo = `${window.location.origin}/`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signInWithSupabaseGoogle() {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw error;
}

export async function signOutSupabase() {
  if (!supabase) return;
  await supabase.auth.signOut();
}
