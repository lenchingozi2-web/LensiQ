import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

function siteOrigin(requestUrl: URL) {
  if (process.env.NODE_ENV !== 'production') return requestUrl.origin;
  // OAuth state/PKCE cookies must be issued and exchanged on the SAME host.
  // Redirect alternate domains to the one configured production domain.
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const url = new URL(configured || 'https://www.lenxiq.online');
    if (url.protocol === 'https:' && ['lenxiq.online', 'www.lenxiq.online'].includes(url.hostname)) {
      return url.origin;
    }
  } catch { /* Use the established production origin. */ }
  return 'https://www.lenxiq.online';
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

export async function GET(request: Request) {
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
        getAll() {
          return request.headers.get('cookie')?.split(';').map((part) => {
            const split = part.trim().indexOf('=');
            return split < 0 ? { name: '', value: '' } :
              { name: part.trim().slice(0, split), value: part.trim().slice(split + 1) };
          }).filter(({name}) => Boolean(name)) || [];
        },
        setAll(cookies) {
          for (const cookie of cookies) outgoingCookies.push(cookie);
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
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

  const response = NextResponse.redirect(data.url, { headers: { 'Cache-Control': 'no-store' } });
  for (const cookie of outgoingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
