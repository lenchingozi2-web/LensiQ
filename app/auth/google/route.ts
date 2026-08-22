import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get('next'));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${requestUrl.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: 'offline', prompt: 'select_account' },
    },
  });

  if (error || !data.url) {
    const message = error?.message?.toLowerCase().includes('provider')
      ? 'Google sign-in is not enabled yet. Please use email and password or try again later.'
      : 'Google sign-in could not be started. Please try again.';
    return NextResponse.redirect(new URL(`/signup?error=${encodeURIComponent(message)}`, requestUrl.origin));
  }

  return NextResponse.redirect(data.url);
}
