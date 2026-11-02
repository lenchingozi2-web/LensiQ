import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateProfile } from '@/lib/profile';
import { issueActiveSession } from '@/lib/auth/active-session';

export const dynamic = 'force-dynamic';

function safeNextPath(value: string | null) {
  if (!value || value.length > 1000 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard';
  }
  try {
    const target = new URL(value, 'https://lenxiq.local');
    if (target.origin !== 'https://lenxiq.local' || target.pathname === '/' ||
        ['/login', '/signup'].includes(target.pathname) || target.pathname.startsWith('/auth/')) {
      return '/dashboard';
    }
    return target.pathname + target.search + target.hash;
  } catch {
    return '/dashboard';
  }
}

function signInError(request: NextRequest, next: string, message: string) {
  const destination = new URL('/login', request.url);
  destination.searchParams.set('next', next);
  destination.searchParams.set('error', message);
  const response = NextResponse.redirect(destination, { status: 303 });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

/**
 * Browser-native form POST avoids the Next 16 Server Action cookie/redirect
 * race. The exact response receiving Supabase cookies is returned to the browser.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) return signInError(request, '/dashboard', 'Invalid sign-in request.');

  const next = safeNextPath(String(form.get('next') ?? ''));
  const intent = form.get('intent') === 'signup' ? 'signup' : 'signin';
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return signInError(request, next, 'Enter your email and password.');

  const destination = new URL(next, request.url);
  const response = NextResponse.redirect(destination, { status: 303 });
  response.headers.set('Cache-Control', 'private, no-store');

  // Use the response cookie jar directly, rather than cookies() inside a
  // Server Action. Read the latest writes during profile/session operations.
  const incoming = new Map(request.cookies.getAll().map(({ name, value }) => [name, value]));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [...incoming].map(([name, value]) => ({ name, value }));
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            incoming.set(name, value);
            response.cookies.set({ name, value, ...options });
          }
          if (headers) {
            for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
          }
        },
      },
    },
  );

  const { data, error } = intent === 'signup'
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    console.warn('[Auth] Password authentication was rejected', { intent, code: error?.code || 'no_user' });
    return signInError(request, next, intent === 'signup'
      ? 'Account creation could not be completed. Please retry.'
      : 'Email or password did not match. Please try again.');
  }

  if (!data.session) {
    return signInError(request, next, 'Check your email to confirm your account, then sign in.');
  }

  const { error: profileError } = await getOrCreateProfile(supabase, data.user);
  if (profileError) {
    console.warn('[Auth] Profile initialization failed after password authentication');
    return signInError(request, next, 'Your account could not be prepared. Please try again.');
  }

  const { token, error: sessionError } = await issueActiveSession(supabase, data.user.id);
  if (sessionError || !token) {
    console.warn('[Auth] Active session initialization failed after password authentication');
    return signInError(request, next, 'Your account session could not be secured. Please try again.');
  }

  response.cookies.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
