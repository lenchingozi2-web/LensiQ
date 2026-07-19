import { createClient } from '../lib/supabase/server';
import Link from 'next/link';

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="w-full p-4 bg-slate-900 text-white flex justify-between items-center shadow-md z-50 relative">
      <div className="font-bold text-xl">
        <Link href="/">Lensiq AI</Link>
      </div>

      <div className="flex gap-4 items-center font-medium">
        {user ? (
          <div className="relative group">
            {/* The User Avatar */}
            <div className="w-10 h-10 bg-amber-500 text-slate-900 rounded-full flex items-center justify-center cursor-pointer font-bold border-2 border-white shadow-sm">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            
            {/* The Dropdown Menu (Hidden until hovered/tapped) */}
            <div className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-lg shadow-xl py-2 hidden group-hover:block border border-slate-100 z-50">
              <Link href="/" className="block px-4 py-2 hover:bg-slate-100 text-sm">Dashboard</Link>
              <Link href="/admin" className="block px-4 py-2 hover:bg-slate-100 text-sm">Admin Panel</Link>
              <hr className="my-1 border-slate-200" />
              <Link href="/logout" className="block px-4 py-2 hover:bg-red-50 text-sm text-red-600 font-bold">Log Out</Link>
            </div>
          </div>
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
