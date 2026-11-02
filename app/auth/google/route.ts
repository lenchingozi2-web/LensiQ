import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

function siteOrigin(requestUrl: URL) {
  // Vercel redirects the apex domain to www. Never start OAuth on a host
  // that the platform will immediately redirect away from: PKCE is host-bound.
  return process.env.NODE_ENV === 'production'
    ? 'https://www.lenxiq.online'
    : requestUrl.origin;
}

function safeNextPath(value: string | null) {
  if (!value || value.length > 1000 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
  try {
    const target = new URL(value, 'https://lenxiq.local');
    if (target.origin !== 'https://lenxiq.local' || target.pathname === '/' ||
        ['/login', '/signup'].includes(target.pathname) || target.pathname.startsWith('/auth/')) return '/dashboard';
    return target.pathname + target.search + target.hash;
  } catch { return '/dashboard'; }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = siteOrigin(requestUrl);
  const next = safeNextPath(requestUrl.searchParams.get('next'));
  if (requestUrl.origin !== origin) {
    const redirect = new URL('/auth/google', origin);
    redirect.searchParams.set('next', next);
    return NextResponse.redirect(redirect, { status: 307, headers: { 'Cache-Control': 'no-store' } });
  }

  // Store PKCE cookies on THE redirect returned to the browser, rather than
  // relying on a request-scoped server helper to transfer them automatically.
  const outgoingCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookies) {
          for (const cookie of cookies) outgoingCookies.push(cookie);
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // An exact URL avoids a query-string mismatch with Supabase's allow list.
      redirectTo: `${origin}/auth/callback`,
      scopes: 'openid email profile',
    },
  });
  if (error || !data.url) {
    console.warn('[Auth] Google OAuth initiation failed', error?.code || 'unknown');
    const fallback = new URL('/login', origin);
    fallback.searchParams.set('error', 'Google sign-in could not be started. Please retry or use email sign-in.');
    fallback.searchParams.set('next', next);
    return NextResponse.redirect(fallback, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Diagnose provider setup without logging authorization codes or tokens.
  console.info('[Auth] Google OAuth redirect issued', {
    requestHost: requestUrl.host,
    pkceCookieIssued: outgoingCookies.some(({ name }) => name.startsWith('sb-') && name.includes('code-verifier')),
  });
  const response = NextResponse.redirect(data.url, { headers: { 'Cache-Control': 'private, no-store' } });
  for (const cookie of outgoingCookies) {
    response.cookies.set({ name: cookie.name, value: cookie.value, ...(cookie.options || {}) });
  }
  // Preserve the safe return path without changing the allow-listed callback.
  response.cookies.set('lensiq_oauth_next', next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return response;
}
