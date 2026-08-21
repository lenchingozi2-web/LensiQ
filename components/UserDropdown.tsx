'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export default function UserDropdown({ email }: { email: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = email ? email.charAt(0).toUpperCase() : 'U';

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(';').forEach((cookie) => {
      document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
    });
    window.location.href = '/signup';
  };

  return <div ref={containerRef} className="relative"><button type="button" aria-label="Open account menu" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-transparent bg-[#E8A23D] font-bold text-slate-900 shadow-sm transition-all hover:border-white">{initial}</button>{isOpen && <div role="menu" className="absolute right-0 z-50 mt-3 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"><div className="border-b border-slate-100 bg-slate-50 p-3"><p className="truncate text-xs font-medium text-slate-500">{email}</p></div><div className="p-2"><Link href="/" onClick={() => setIsOpen(false)} className="block rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#E8A23D]">Home</Link><Link href="/pricing" onClick={() => setIsOpen(false)} className="block rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#E8A23D]">Subscription plans</Link><Link href="/admin" onClick={() => setIsOpen(false)} className="block rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#E8A23D]">Admin Panel</Link><div className="my-1 h-px bg-slate-100" /><button type="button" onClick={() => void handleLogout()} className="w-full rounded-xl px-4 py-2.5 text-left text-sm font-bold text-red-600 transition-colors hover:bg-red-50">Log Out</button></div></div>}</div>;
}
