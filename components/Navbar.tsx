import Link from 'next/link';
import { createClient } from '../lib/supabase/server';

export default async function Navbar() {
  // 1. Fetch the user securely from the server
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 2. Check if they are an admin
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    isAdmin = profile?.role === 'admin';
  }

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center gap-1">
              <span className="text-2xl font-black text-[#0B1220] tracking-tight">
                Lensiq<span className="text-[#E8A23D]">AI</span>
              </span>
            </Link>
          </div>

          {/* Navigation Links & Avatar */}
          <div className="flex items-center gap-6">
            
            {/* The spaced-out Study Mode link */}
            <Link href="/browse" className="ml-4 font-bold text-sm text-[#E8A23D] hover:text-amber-600 transition-colors">
              Study Mode
            </Link>

            {/* NEW: Teaching Room Link */}
            <Link href="/teach" className="font-bold text-sm text-slate-500 hover:text-[#E8A23D] transition-colors">
              Teaching Room
            </Link>
            
            <Link href="/dashboard" className="font-bold text-sm text-slate-500 hover:text-[#0B1220] transition-colors">
              Dashboard
            </Link>

            {/* Functional User Dropdown Menu */}
            {user ? (
              <details className="relative group cursor-pointer list-none ml-2">
                <summary className="list-none outline-none">
                  {/* Dynamic Avatar (Uses the first letter of their email) */}
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-indigo-200 hover:border-indigo-400 transition-colors">
                    <span className="text-indigo-700 font-bold text-sm uppercase">
                      {user.email?.charAt(0)}
                    </span>
                  </div>
                </summary>
                
                {/* The Dropdown Card */}
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-2 flex flex-col gap-1 z-50">
                  <div className="px-3 py-2 mb-1 border-b border-slate-100">
                    <p className="text-xs text-slate-500">Signed in as</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
                  </div>

                  <Link href="/dashboard" className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                    📚 Study Dashboard
                  </Link>
                  
                  {/* Only visible to you (Admin) */}
                  {isAdmin && (
                    <Link href="/admin" className="px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 rounded-lg transition-colors font-medium">
                      ⚙️ Admin Command Center
                    </Link>
                  )}
                  
                  {/* The Logout Engine */}
                  <form action="/auth/signout" method="POST" className="mt-1 border-t border-slate-100 pt-1">
                    <button type="submit" className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      Log Out
                    </button>
                  </form>
                </div>
              </details>
            ) : (
              // If they are not logged in, show a Sign In button
              <Link href="/signup" className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition-colors ml-2">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
