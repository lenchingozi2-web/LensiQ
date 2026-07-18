import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  
  // Destroy the active session
  await supabase.auth.signOut();
  
  // Redirect back to the signup/login page
  return NextResponse.redirect(new URL('/signup', req.url), {
    status: 302,
  });
}
