import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

function siteOrigin(requestUrl: URL) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.origin;
    } catch {
      // Fall through to the production default or local request origin.
    }
  }
  return process.env.NODE_ENV === 'production' ? 'https://www.lenxiq.online' : requestUrl.origin;
}

function safeNextPath(value: string | null) {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/dashboard';
  const pathname = new URL(value, 'http://localhost').pathname;
  return pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/') ? '/dashboard' : value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = siteOrigin(requestUrl);
  const next = safeNextPath(requestUrl.searchParams.get('next'));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    const message = error?.message?.toLowerCase().includes('provider')
      ? 'Google sign-in is not enabled for LenxiQ yet. Please use email and password or contact the administrator.'
      : 'Google sign-in could not be started. Please try again.';
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`, origin));
  }

  return NextResponse.redirect(data.url);
}
