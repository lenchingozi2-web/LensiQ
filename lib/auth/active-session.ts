import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

export const ACTIVE_SESSION_COOKIE = 'session_token';

const activeSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function issueActiveSession(supabase: SupabaseClient, userId: string) {
  const token = crypto.randomUUID();
  const { data, error } = await supabase
    .from('profiles')
    .update({ session_token: token })
    .eq('id', userId)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return {
      token: null,
      error: error?.message ?? 'The account profile could not be updated for this session.',
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SESSION_COOKIE, token, activeSessionCookieOptions);
  return { token, error: null };
}

export async function clearActiveSession(supabase: SupabaseClient, userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACTIVE_SESSION_COOKIE)?.value;

  if (token) {
    const { error } = await supabase
      .from('profiles')
      .update({ session_token: null })
      .eq('id', userId)
      .eq('session_token', token);

    if (error) console.error('[Auth] Could not clear the active session token:', error.message);
  }

  cookieStore.delete(ACTIVE_SESSION_COOKIE);
}

export async function clearActiveSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_SESSION_COOKIE);
}
