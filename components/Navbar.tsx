import { createClient } from '../lib/supabase/server';
import Link from 'next/link';
import UserDropdown from './UserDropdown';
import MobileNav from './MobileNav';
import NavbarControls from './NavbarControls';
import { primaryNavigation, secondaryNavigation } from '@/lib/navigation';

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let userRole: 'admin' | 'user' = 'user';

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      // A temporary profile lookup failure must not turn into a false logout.
      console.error('[Navbar] Profile role/session lookup failed:', profileError.message);
    } else {
      userRole = profile?.role === 'admin' ? 'admin' : 'user';
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-[0_4px_20px_rgba(15,23,42,0.05)] backdrop-blur">
      <nav className="mx-auto flex min-h-[4.5rem] w-full max-w-[1440px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <Link href="/" className="group flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-lg font-black text-[#E8A23D] shadow-sm">LQ</span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-sm font-black tracking-tight text-[#0B1220] sm:text-base">LenxiQ AI</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:block">Medical learning</span>
          </span>
        </Link>

        <NavbarControls
          links={user ? primaryNavigation : primaryNavigation.filter((link) => link.href !== '/dashboard')}
          isAuthenticated={Boolean(user)}
        />

        <div className="flex shrink-0 items-center gap-2">
          {user && <UserDropdown email={user.email || 'User'} role={userRole} />}
          <MobileNav links={user ? primaryNavigation : primaryNavigation.filter((link) => link.href !== '/dashboard')} secondaryLinks={secondaryNavigation} isAuthenticated={Boolean(user)} />
        </div>
      </nav>
    </header>
  );
}
