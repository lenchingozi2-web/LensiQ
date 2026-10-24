import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getOrCreateProfile } from '../../../lib/profile';
import { issueActiveSession } from '../../../lib/auth/active-session';

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
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  const pathname = new URL(value, 'http://localhost').pathname;
  if (pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/')) return '/dashboard';
  return value;
}

function noStoreRedirect(origin: string, path: string) {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = siteOrigin(requestUrl);
  const code = requestUrl.searchParams.get('code');
  const next = safeNextPath(requestUrl.searchParams.get('next'));
  const errorDescription = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

  if (errorDescription) {
    return noStoreRedirect(origin, `/login?error=${encodeURIComponent(`Google sign-in was cancelled or rejected: ${errorDescription}`)}&next=${encodeURIComponent(next)}`);
  }
  if (!code) {
    return noStoreRedirect(origin, `/login?error=${encodeURIComponent('Google sign-in returned no authorization code. Please try again, or use email and password.')}&next=${encodeURIComponent(next)}`);
  }

  // OAuth session cookies must be attached to the redirect response itself.
  // The generic server client uses a request-scoped cookie adapter and can
  // otherwise exchange the code successfully while the browser receives no
  // refreshed Supabase cookie.
  const response = NextResponse.redirect(new URL(next, origin));
  response.headers.set('Cache-Control', 'no-store');
  const requestCookies = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return requestCookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set({ name, value, ...options }));
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('[Auth] Google OAuth code exchange failed:', exchangeError.message);
    return noStoreRedirect(origin, `/login?error=${encodeURIComponent('Google sign-in could not complete its secure callback. Please try again from this page.')}&next=${encodeURIComponent(next)}`);
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return noStoreRedirect(origin, `/login?error=${encodeURIComponent('Google sign-in did not return a valid account.')}&next=${encodeURIComponent(next)}`);
  }
  const { error: bootstrapError } = await getOrCreateProfile(supabase, user);
  if (bootstrapError) {
    console.error('[Auth] Google account bootstrap failed:', bootstrapError.message);
    return noStoreRedirect(origin, `/login?error=${encodeURIComponent('Your account could not be initialized. Please try again.')}&next=${encodeURIComponent(next)}`);
  }

  const { token: activeToken, error: activeSessionError } = await issueActiveSession(supabase, user.id);
  if (activeSessionError || !activeToken) {
    console.error('[Auth] Google active-session issuance failed:', activeSessionError);
    await supabase.auth.signOut({ scope: 'local' });
    return noStoreRedirect(origin, `/login?error=${encodeURIComponent('Your account session could not be secured. Please try again.')}&next=${encodeURIComponent(next)}`);
  }
  // Make the application session cookie explicit on the same response too.
  response.cookies.set('session_token', activeToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
