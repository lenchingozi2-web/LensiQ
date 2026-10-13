import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
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
  return process.env.NODE_ENV === 'production' ? 'https://lenxiq.online' : requestUrl.origin;
}

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  const pathname = new URL(value, 'http://localhost').pathname;
  if (pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/')) return '/dashboard';
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = siteOrigin(requestUrl);
  const code = requestUrl.searchParams.get('code');
  const next = safeNextPath(requestUrl.searchParams.get('next'));
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDescription)}&next=${encodeURIComponent(next)}`, origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Google sign-in could not be completed. Please try again.')}&next=${encodeURIComponent(next)}`, origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('[Auth] Google OAuth code exchange failed:', exchangeError.message);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Google sign-in could not be completed. Please try again.')}&next=${encodeURIComponent(next)}`, origin));
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Google sign-in did not return a valid account.')}&next=${encodeURIComponent(next)}`, origin));
  }

  const { error: bootstrapError } = await getOrCreateProfile(supabase, user);
  if (bootstrapError) {
    console.error('[Auth] Google account bootstrap failed:', bootstrapError.message);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Your account could not be initialized. Please try again.')}&next=${encodeURIComponent(next)}`, origin));
  }

  const { error: activeSessionError } = await issueActiveSession(supabase, user.id);
  if (activeSessionError) {
    console.error('[Auth] Google active-session issuance failed:', activeSessionError);
    await supabase.auth.signOut({ scope: 'local' });
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('Your account session could not be secured. Please try again.')}&next=${encodeURIComponent(next)}`, origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
