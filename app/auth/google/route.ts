import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Keep the provider redirect exactly equal to the Supabase allow-listed callback URL.
      // The destination is selected after the code exchange by the callback route.
      redirectTo: `${requestUrl.origin}/auth/callback`,
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
