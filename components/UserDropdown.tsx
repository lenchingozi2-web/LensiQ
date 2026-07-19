"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function UserDropdown({ email }: { email: string }) {
  const [isOpen, setIsOpen] = useState(false);

  // Get the first letter of the email for the avatar (e.g., "L" for your admin email)
  const initial = email ? email.charAt(0).toUpperCase() : 'U';

  const handleLogout = async () => {
    // 1. Wipe all local ghost sessions
    localStorage.clear();
    sessionStorage.clear();

    // 2. Wipe the cookies directly in the browser
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // 3. Force a hard reload to the homepage to completely clear Next.js memory
    window.location.href = '/';
  };

  return (
    <div className="relative">
      {/* Avatar Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-[#E8A23D] text-slate-900 font-bold flex items-center justify-center border-2 border-transparent hover:border-white transition-all shadow-sm"
      >
        {initial}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500 font-medium truncate">{email}</p>
          </div>
          <div className="p-2">
            <Link 
              href="/" 
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-slate-700 font-medium hover:bg-slate-50 hover:text-[#E8A23D] rounded-xl transition-colors"
            >
              home
            </Link>
            <Link 
              href="/admin" 
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-slate-700 font-medium hover:bg-slate-50 hover:text-[#E8A23D] rounded-xl transition-colors"
            >
              Admin Panel
            </Link>
            <div className="h-px bg-slate-100 my-1"></div>
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
