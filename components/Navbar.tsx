import { createClient } from '../lib/supabase/server';
import Link from 'next/link';
import UserDropdown from './UserDropdown';
import MobileNav from './MobileNav';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const primaryLinks = [
  { href: '/curriculum', label: 'Study', shortLabel: 'Curriculum' },
  { href: '/browse', label: 'Practice', shortLabel: 'Question bank' },
  { href: '/search', label: 'Search', shortLabel: 'Find questions' },
  { href: '/teach', label: 'Teach', shortLabel: 'AI Teaching' },
  { href: '/voice', label: 'Voice Tutor', shortLabel: 'Speak with LenxiQ AI' },
  { href: '/voice?mode=class', label: 'Live Class', shortLabel: 'Live teaching room' },
];

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const cookieStore = await cookies();
    const localToken = cookieStore.get('session_token')?.value;
    const { data: profile } = await supabase.from('profiles').select('session_token').eq('id', user.id).single();

    if (profile?.session_token && profile.session_token !== localToken) {
      return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-2xl">
            <span className="mb-6 block text-5xl">!</span>
            <h2 className="mb-3 text-2xl font-black text-slate-900">Session expired</h2>
            <p className="mb-8 leading-relaxed text-slate-600">Your account was recently logged in from another device. For your security, this active session has been paused.</p>
            <form action={async () => {
              'use server';
              const supabaseServer = await createClient();
              await supabaseServer.auth.signOut();
              redirect('/signup');
            }}>
              <button className="w-full rounded-xl bg-slate-900 py-4 font-bold text-white shadow-md hover:bg-slate-800">Log in again</button>
            </form>
          </div>
        </div>
      );
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 shadow-[0_4px_20px_rgba(15,23,42,0.05)] backdrop-blur">
      <nav className="mx-auto flex min-h-[4.5rem] w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-lg font-black text-[#E8A23D] shadow-sm">LQ</span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black tracking-tight text-[#0B1220]">LenxiQ AI</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:block">Medical learning</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {primaryLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-[#0B1220]">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/pricing" className="rounded-lg border border-[#E8A23D]/50 bg-[#FFF8E9] px-3 py-2 text-xs font-black text-[#8B5709] hover:bg-[#FFF0CF] sm:text-sm">Plans</Link>
          {user ? <UserDropdown email={user.email || 'User'} /> : <Link href="/signup" className="rounded-xl bg-[#0B1220] px-3.5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-800 sm:px-4">Get started</Link>}
          <MobileNav links={primaryLinks} />
        </div>
      </nav>
    </header>
  );
}
