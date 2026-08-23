import { createClient } from '../../lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // This legacy field is retained for database compatibility. It is no longer
      // used as a browser-wide device lock, so signing out cannot invalidate
      // another active browser session.
      await supabase.from('profiles').update({ session_token: null }).eq('id', user.id);
    }

    await supabase.auth.signOut();
  } catch (error) {
    // Logout must remain recoverable even if the auth service is briefly unavailable.
    console.error('[Logout] Auth cleanup failed:', error);
  }

  const cookieStore = await cookies();
  cookieStore.delete('session_token');

  return NextResponse.redirect(new URL('/login?logged_out=1', request.url));
}
