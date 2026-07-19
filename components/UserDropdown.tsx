'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function UserDropdown({ email }: { email: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* The Avatar (Now actively listens for taps) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-amber-500 text-slate-900 rounded-full flex items-center justify-center cursor-pointer font-bold border-2 border-white shadow-sm"
      >
        {email.charAt(0).toUpperCase()}
      </div>
      
      {/* The Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white text-slate-800 rounded-lg shadow-xl py-2 border border-slate-100 z-50">
          <Link href="/" className="block px-4 py-2 hover:bg-slate-100 text-sm" onClick={() => setIsOpen(false)}>Dashboard</Link>
          <Link href="/admin" className="block px-4 py-2 hover:bg-slate-100 text-sm" onClick={() => setIsOpen(false)}>Admin Panel</Link>
          <hr className="my-1 border-slate-200" />
          <Link href="/logout" className="block px-4 py-2 hover:bg-red-50 text-sm text-red-600 font-bold" onClick={() => setIsOpen(false)}>Log Out</Link>
        </div>
      )}
    </div>
  );
}
