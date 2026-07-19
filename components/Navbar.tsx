import { createClient } from '../lib/supabase/server';
import Link from 'next/link';
import UserDropdown from './UserDropdown';

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <nav className="w-full p-4 bg-slate-900 text-white flex justify-between items-center shadow-md z-50 relative">
      <div className="font-bold text-xl cursor-default select-none">
        Lensiq AI
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
