'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { LOGIN_PATH, type NavigationLink } from '@/lib/navigation';

type Props = {
  links: NavigationLink[];
  secondaryLinks: NavigationLink[];
  isAuthenticated: boolean;
};

export default function MobileNav({ links, secondaryLinks, isAuthenticated }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString() ? `?${params.toString()}` : '';
  const currentPath = `${pathname}${search}`;
  const loginPath = `${LOGIN_PATH}?next=${encodeURIComponent(currentPath)}`;

  useEffect(() => { setIsOpen(false); }, [pathname, search]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    firstItemRef.current?.focus();
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const active = (link: NavigationLink) => {
    const target = new URL(link.href, 'https://lenxiq.local');
    return target.pathname === pathname && (!target.search || target.search === search);
  };
  const renderLink = (link: NavigationLink, index: number) => (
    <Link
      key={link.href}
      href={link.href}
      ref={index === 0 ? firstItemRef : undefined}
      onClick={() => setIsOpen(false)}
      aria-current={active(link) ? 'page' : undefined}
      className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${active(link)
        ? 'border-amber-300/60 bg-amber-50 text-[#81500a]'
        : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${active(link) ? 'bg-[#E8A23D]' : 'bg-slate-300'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{link.label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{link.description}</span>
      </span>
      <span className="text-sm text-slate-400" aria-hidden="true">›</span>
    </Link>
  );

  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        <span aria-hidden="true">{isOpen ? '×' : '☰'}</span>
      </button>
      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-[#0B1220]/30 backdrop-blur-[2px]"
          />
          <nav
            id={menuId}
            aria-label="Mobile study navigation"
            className="absolute right-0 top-14 z-50 max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100vw-1rem))] min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-[0_28px_90px_rgba(15,23,42,.25)]"
          >
            <div className="rounded-xl bg-[#0B1220] p-4 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#E8A23D]">LenxiQ AI workspace</p>
              <p className="mt-1 text-sm font-bold">Your medical study, in one place.</p>
            </div>
            <p className="px-3 pb-2 pt-5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Study essentials</p>
            <div className="space-y-1">{links.map((link, index) => renderLink(link, index))}</div>
            <p className="mt-4 border-t border-slate-100 px-3 pb-2 pt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Explore and manage</p>
            <div className="space-y-1">{secondaryLinks.map((link, index) => renderLink(link, index + links.length))}</div>
            <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3">
              <Link href="/pricing" onClick={() => setIsOpen(false)} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-bold text-[#81500a]">Plans and access</Link>
              {!isAuthenticated && pathname !== '/login' && pathname !== '/signup' && (
                <Link href={loginPath} onClick={() => setIsOpen(false)} className="rounded-xl bg-[#0B1220] px-4 py-3 text-center text-sm font-bold text-white">Sign in</Link>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
