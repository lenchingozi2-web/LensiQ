'use client';

import { useState } from 'react';

type GoogleSignInButtonProps = {
  next: string;
  className?: string;
};

export default function GoogleSignInButton({ next, className = '' }: GoogleSignInButtonProps) {
  const [starting, setStarting] = useState(false);
  const href = `/auth/google?next=${encodeURIComponent(next)}`;

  return (
    <button
      type="button"
      disabled={starting}
      onClick={() => {
        setStarting(true);
        window.location.assign(href);
      }}
      className={`flex w-full items-center justify-center gap-3 disabled:cursor-wait disabled:opacity-70 ${className}`}
      aria-label="Continue with Google"
    >
      <span aria-hidden="true" className="text-base font-black">G</span>
      {starting ? 'Opening Google…' : 'Continue with Google'}
    </button>
  );
}
