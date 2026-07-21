import { createClient } from '../../lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const supabase = await createClient();
  
  // 1. Identify the user BEFORE destroying the session
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // 2. Erase the "Master Device" lock from the database so you can log in again later
    await supabase.from('profiles').update({ session_token: null }).eq('id', user.id);
  }
  
  // 3. Destroy the Supabase session
  await supabase.auth.signOut();
  
  // 4. Destroy the custom security cookie in the browser (FIXED with await)
  const cookieStore = await cookies();
  cookieStore.delete('session_token');
  
  // 5. Force a hard, secure redirect
  return NextResponse.redirect('https://lenxiq.online/login');
}
