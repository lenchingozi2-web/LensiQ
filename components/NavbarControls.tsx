'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LOGIN_PATH, type NavigationLink } from '@/lib/navigation';

type NavbarControlsProps = {
  links: NavigationLink[];
  isAuthenticated: boolean;
};

function isActiveLink(href: string, pathname: string, search: string) {
  const target = new URL(href, 'http://localhost');
  return target.pathname === pathname && target.search === search;
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
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link href="/pricing" className="rounded-lg border border-[#E8A23D]/50 bg-[#FFF8E9] px-3 py-2 text-xs font-black text-[#8B5709] hover:bg-[#FFF0CF] sm:text-sm">Plans</Link>
        {!isAuthenticated && (
          <>
            <Link href={`${LOGIN_PATH}${authQuery}`} className="hidden rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-black text-[#0B1220] hover:bg-slate-50 sm:inline-flex">Sign In</Link>
            <Link href={`${LOGIN_PATH}${authQuery}`} className="rounded-xl bg-[#0B1220] px-3.5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-slate-800 sm:px-4">Get Started</Link>
          </>
        )}
      </div>
    </>
  );
}
