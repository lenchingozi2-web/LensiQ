import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '../../../lib/supabase/server';

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

  const sessionToken = crypto.randomUUID();
  const { error: profileError } = await supabase.from('profiles').update({ session_token: sessionToken }).eq('id', user.id);
  if (profileError) console.error('[Google Auth] Could not synchronize session token:', profileError);

  const cookieStore = await cookies();
  cookieStore.set('session_token', sessionToken, { path: '/' });

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
