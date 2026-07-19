import { createClient } from '../../lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // 1. Connect to Supabase
  const supabase = await createClient();
  
  // 2. Destroy the active user session securely
  await supabase.auth.signOut();
  
  // 3. Instantly redirect the user back to the homepage
  return NextResponse.redirect(new URL('/login', request.url));
}
