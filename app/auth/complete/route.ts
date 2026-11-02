import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateProfile } from '@/lib/profile';
import { issueActiveSession } from '@/lib/auth/active-session';

export const dynamic = 'force-dynamic';

function safeNextPath(value: string | null) {
  if (!value || value.length > 1000 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard';
  }
  try {
    const destination = new URL(value, 'https://lenxiq.local');
    if (destination.origin !== 'https://lenxiq.local' || ['/login', '/signup'].includes(destination.pathname) ||
        destination.pathname.startsWith('/auth/')) return '/dashboard';
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return '/dashboard';
  }
}

function failedLogin(request: NextRequest, message: string, next: string) {
  const destination = new URL('/login', request.url);
  destination.searchParams.set('error', message);
  destination.searchParams.set('next', next);
  const response = NextResponse.redirect(destination, { status: 303 });
  response.headers.set('Cache-Control', 'private, no-store');
  // An incomplete application session must not cause Login -> Dashboard -> Login loops.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-') || cookie.name === 'session_token') {
      response.cookies.delete(cookie.name);
    }
  }
  return response;
}

/**
 * The callback writes Supabase PKCE-session cookies, then redirects here.
 * This separate browser request verifies that those cookies actually survived
 * the OAuth redirect before creating the application's single-session token.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn('[Auth] Google completion session verification failed', { code: authError?.code || 'no_user' });
    return failedLogin(request, 'Google sign-in did not establish a browser session. Please try again.', next);
  }

  const { error: profileError } = await getOrCreateProfile(supabase, user);
  if (profileError) {
    console.warn('[Auth] Google profile initialization failed', { code: 'code' in profileError ? profileError.code : 'unknown' });
    return failedLogin(request, 'Your Google account was verified, but its study profile could not be prepared. Please retry.', next);
  }

  const { token, error: sessionError } = await issueActiveSession(supabase, user.id);
  if (sessionError || !token) {
    console.warn('[Auth] Google application session initialization failed');
    return failedLogin(request, 'Your Google account was verified, but the app session could not be secured. Please retry.', next);
  }

  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  response.headers.set('Cache-Control', 'private, no-store');
  // A response-local cookie guarantees the middleware and Navbar see the same
  // new session ID on the very next request.
  response.cookies.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
