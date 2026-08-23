import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { getOrCreateProfile } from '../../../lib/profile';
import { issueActiveSession } from '../../../lib/auth/active-session';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeNextPath(requestUrl.searchParams.get('next'));
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent(errorDescription)}`, requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/signup?error=Google sign-in could not be completed.', requestUrl.origin));
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent('Google sign-in could not be completed. Please try again.')}`, requestUrl.origin));
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.redirect(new URL('/signup?error=Google sign-in did not return a valid account.', requestUrl.origin));
  }

  const { error: bootstrapError } = await getOrCreateProfile(supabase, user);
  if (bootstrapError) {
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent('Your account could not be initialized. Please try again.')}`, requestUrl.origin));
  }

  const { error: activeSessionError } = await issueActiveSession(supabase, user.id);
  if (activeSessionError) {
    await supabase.auth.signOut({ scope: 'local' });
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent('Your account session could not be secured. Please try again.')}`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
