'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LOGIN_PATH, type NavigationLink } from '@/lib/navigation';

export default function MobileNav({ links, secondaryLinks, isAuthenticated }: { links: NavigationLink[]; secondaryLinks: NavigationLink[]; isAuthenticated: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const currentPath = `${pathname}${search}`;
  const authQuery = `?next=${encodeURIComponent(currentPath)}`;

  const linkClassName = (link: NavigationLink) => {
    const target = new URL(link.href, 'http://localhost');
    return `block rounded-xl px-4 py-3 ${target.pathname === pathname && target.search === search ? 'bg-[#FFF8E9]' : 'hover:bg-slate-50'}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return <div ref={containerRef} className="relative lg:hidden"><button type="button" aria-label="Open navigation menu" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-700 shadow-sm">{isOpen ? '×' : '☰'}</button>{isOpen && <div role="menu" className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"><p className="px-4 pb-2 pt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Core learning</p>{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)} className={linkClassName(link)} aria-current={linkClassName(link).includes('bg-[#FFF8E9]') ? 'page' : undefined}><span className="block text-sm font-black text-slate-900">{link.label}</span><span className="block text-xs font-medium text-slate-500">{link.description}</span></Link>)}<p className="border-t border-slate-100 px-4 pb-2 pt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Tools</p>{secondaryLinks.map((link) => <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)} className={linkClassName(link)}><span className="block text-sm font-black text-slate-900">{link.label}</span><span className="block text-xs font-medium text-slate-500">{link.description}</span></Link>)}{!isAuthenticated && <div className="mt-1 grid grid-cols-2 gap-2 border-t border-slate-100 p-2"><Link href={`${LOGIN_PATH}${authQuery}`} onClick={() => setIsOpen(false)} className="rounded-xl border border-slate-300 px-3 py-3 text-center text-sm font-black text-slate-900">Sign In</Link><Link href={`${LOGIN_PATH}${authQuery}`} onClick={() => setIsOpen(false)} className="rounded-xl bg-[#0B1220] px-3 py-3 text-center text-sm font-black text-white">Get Started</Link></div>}<Link href="/pricing" onClick={() => setIsOpen(false)} className="mt-1 block rounded-xl border-t border-slate-100 px-4 py-3 text-sm font-black text-[#9A5D00]">Plans and access</Link></div>}</div>;
}
