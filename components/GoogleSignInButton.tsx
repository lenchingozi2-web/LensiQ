'use client';

type GoogleSignInButtonProps = { next: string; className?: string };

export default function GoogleSignInButton({ next, className = '' }: GoogleSignInButtonProps) {
  const href = `/auth/google?next=${encodeURIComponent(next)}`;

  // A real link works in mobile browsers even if JavaScript initializes late.
  // OAuth, including the PKCE redirect cookies, is handled server-side.
  return (
    <a
      href={href}
      aria-label="Continue with Google"
      className={`flex w-full min-h-12 items-center justify-center gap-3 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M21.6 12.23c0-.7-.06-1.4-.18-2.07H12v3.92h5.39a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.97-4.3 2.97-7.38Z"/>
        <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.39l-3.24-2.51c-.9.6-2.05.94-3.38.94-2.61 0-4.83-1.76-5.62-4.13H3.05v2.58A10 10 0 0 0 12 22Z"/>
        <path fill="#FBBC05" d="M6.38 13.91a6 6 0 0 1 0-3.82V7.51H3.05a10 10 0 0 0 0 8.98l3.33-2.58Z"/>
        <path fill="#EA4335" d="M12 5.96c1.47 0 2.8.51 3.83 1.51l2.87-2.87A9.59 9.59 0 0 0 12 2a10 10 0 0 0-8.95 5.51l3.33 2.58C7.17 7.72 9.39 5.96 12 5.96Z"/>
      </svg>
      Continue with Google
    </a>
  );
}
