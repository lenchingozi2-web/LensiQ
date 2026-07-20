import { createClient } from '../lib/supabase/server';
import Link from 'next/link';
import UserDropdown from './UserDropdown';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // THE SECURITY GUARD
  if (user) {
    // Await the cookies to fix the Next.js 15 type error
    const cookieStore = await cookies();
    
    // @ts-ignore: Bypassing strict type check for Vercel build
    const localToken = cookieStore.get('session_token')?.value;

    const { data: profile } = await supabase
      .from('profiles')
      .select('session_token')
      .eq('id', user.id)
      .single();

    // If the database has a token, but it doesn't match the browser's cookie
    if (profile?.session_token && profile.session_token !== localToken) {
      return (
        <div className="fixed inset-0 bg-slate-50 z-[9999] flex flex-col items-center justify-center p-6">
          <div className="bg-white p-8 rounded-3xl max-w-md w-full text-center shadow-2xl border border-slate-200">
            <span className="text-6xl mb-6 block">⚠️</span>
            <h2 className="text-2xl font-black text-slate-900 mb-3">Session Expired</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              Your account was recently logged in from another device. For your security, this active session has been paused.
            </p>
            <form action={async () => {
              "use server";
              const supabaseServer = await createClient();
              await supabaseServer.auth.signOut();
              redirect('/signup');
            }}>
              <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-md">
                Log In Again
              </button>
            </form>
          </div>
        </div>
      );
    }
  }

  return (
    <nav className="w-full p-4 bg-slate-900 text-white flex justify-between items-center shadow-md z-50 relative">
      <div className="font-bold text-xl cursor-default select-none">
        LenxiQ AI
      </div>
      
      <div className="flex gap-4 items-center font-medium">
        {user ? (
          <UserDropdown email={user.email || 'User'} />
        ) : (
          <>
            <Link href="/pricing" className="hover:text-amber-400 transition-colors">Pricing</Link>
            <Link href="/signup" className="hover:text-amber-400 transition-colors">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
