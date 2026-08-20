'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type NavigationLink = { href: string; label: string; shortLabel: string };

export default function MobileNav({ links }: { links: NavigationLink[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return <div ref={containerRef} className="relative lg:hidden"><button type="button" aria-label="Open navigation menu" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg font-black text-slate-700 shadow-sm">{isOpen ? '×' : '☰'}</button>{isOpen && <div role="menu" className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">{links.map((link) => <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)} className="block rounded-xl px-4 py-3 hover:bg-slate-50"><span className="block text-sm font-black text-slate-900">{link.label}</span><span className="block text-xs font-medium text-slate-500">{link.shortLabel}</span></Link>)}<Link href="/pricing" onClick={() => setIsOpen(false)} className="mt-1 block rounded-xl border-t border-slate-100 px-4 py-3 text-sm font-black text-[#9A5D00]">Plans and access</Link></div>}</div>;
}
