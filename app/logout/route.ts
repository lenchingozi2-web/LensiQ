import { createClient } from '../../lib/supabase/server';
import { NextResponse } from 'next/server';
import { clearActiveSession, clearActiveSessionCookie } from '../../lib/auth/active-session';

export async function GET(request: Request) {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await clearActiveSession(supabase, user.id);
    } else {
      await clearActiveSessionCookie();
    }

    // Local scope removes this browser's auth session without revoking a newer
    // session that may already be active on another device.
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    // Logout must remain recoverable even if the auth service is briefly unavailable.
    console.error('[Logout] Auth cleanup failed:', error);
    await clearActiveSessionCookie();
  }

  return NextResponse.redirect(new URL('/login?logged_out=1', request.url));
}
