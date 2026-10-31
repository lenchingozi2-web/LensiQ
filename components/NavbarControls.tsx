'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LOGIN_PATH, secondaryNavigation, type NavigationLink } from '@/lib/navigation';

type NavbarControlsProps = {
  links: NavigationLink[];
  isAuthenticated: boolean;
};

function isActiveLink(href: string, pathname: string, search: string) {
  const target = new URL(href, 'http://localhost');
  if (target.pathname !== pathname) return false;
  const current = new URLSearchParams(search);
  for (const [key, value] of target.searchParams) {
    if (current.get(key) !== value) return false;
  }
  return true;
}

export default function NavbarControls({ links, isAuthenticated }: NavbarControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const currentPath = `${pathname}${search}`;
  const authQuery = `?next=${encodeURIComponent(currentPath)}`;

  return (
    <>
      <div className="hidden items-center gap-1 lg:flex">
        {links.map((link) => {
          const active = isActiveLink(link.href, pathname, search);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${active ? 'bg-[#FFF8E9] text-[#9A5D00]' : 'text-slate-600 hover:bg-slate-100 hover:text-[#0B1220]'}`}
            >
              {link.label}
            </Link>
          );
        })}
        <details className="group relative">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-[#0B1220] [&::-webkit-details-marker]:hidden">
            More <span className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <nav aria-label="Additional study tools" className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
            <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">More ways to study</p>
            {secondaryNavigation.map((link) => (
              <Link key={link.href} href={link.href}
                aria-current={isActiveLink(link.href, pathname, search) ? 'page' : undefined}
                className={`block rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50 ${isActiveLink(link.href, pathname, search) ? 'bg-amber-50' : ''}`}
              >
                <span className="block text-sm font-bold text-slate-800">{link.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{link.description}</span>
              </Link>
            ))}
          </nav>
        </details>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {pathname !== '/pricing' && <Link href="/pricing" className="hidden rounded-lg border border-[#E8A23D]/50 bg-[#FFF8E9] px-3 py-2 text-xs font-black text-[#8B5709] hover:bg-[#FFF0CF] sm:inline-flex sm:text-sm">Plans</Link>}
        {!isAuthenticated && pathname !== '/login' && pathname !== '/signup' && (
          <>
            <Link href={`${LOGIN_PATH}${authQuery}`} className="rounded-xl bg-[#0B1220] px-3 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800 sm:px-4 sm:py-2.5">Sign in</Link>
          </>
        )}
      </div>
    </>
  );
}
