import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

function siteOrigin(requestUrl: URL) {
  // Vercel redirects the apex domain to www. Never start OAuth on a host
  // that the platform will immediately redirect away from: PKCE is host-bound.
  return process.env.NODE_ENV === 'production'
    ? 'https://www.lenxiq.online'
    : requestUrl.origin;
}

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  const pathname = new URL(value, 'http://localhost').pathname;
  if (pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/')) return '/dashboard';
  return value;
}

function noStoreRedirect(origin: string, path: string) {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = siteOrigin(requestUrl);
  // Keep the PKCE verifier and single-use authorization code on the same host.
  if (requestUrl.origin !== origin) {
    return NextResponse.redirect(new URL(requestUrl.pathname + requestUrl.search, origin), {
      status: 307,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  const code = requestUrl.searchParams.get('code');
  const next = safeNextPath(requestUrl.searchParams.get('next'));
  const errorDescription = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');

  console.error('[AuthDiag] Google OAuth callback reached', {
    requestHost: requestUrl.host,
    hasAuthorizationCode: Boolean(code),
    hasProviderError: Boolean(errorDescription),
  });

  if (errorDescription) {
    return noStoreRedirect(origin, `/login?error=${encodeURIComponent(`Google sign-in was cancelled or rejected: ${errorDescription}`)}&next=${encodeURIComponent(next)}`);
  }
  if (!code) {
    return noStoreRedirect(origin, `/login?error=${encodeURIComponent('Google sign-in returned no authorization code. Please try again, or use email and password.')}&next=${encodeURIComponent(next)}`);
  }

  // OAuth session cookies must be attached to the redirect response itself.
  // The generic server client uses a request-scoped cookie adapter and can
  // otherwise exchange the code successfully while the browser receives no
  // refreshed Supabase cookie.
  const completion = new URL('/auth/complete', origin);
  completion.searchParams.set('next', next);
  const response = NextResponse.redirect(completion, { status: 303 });
  response.headers.set('Cache-Control', 'no-store');
  let authCookieWriteObserved = false;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Keep the request-side jar in sync for getUser/profile reads after
            // exchanging the single-use PKCE code, and persist to the browser.
            request.cookies.set({ name, value, ...options });
            response.cookies.set({ name, value, ...options });
            if (name.startsWith('sb-') && name.includes('-auth-token') && !name.includes('code-verifier')) authCookieWriteObserved = true;
          });
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error('[AuthDiag] Google OAuth code exchange failed', {
      authCookieWriteObserved,
      authErrorCode: exchangeError.code || null,
      authErrorStatus: typeof exchangeError.status === 'number' ? exchangeError.status : null,
      authErrorName: exchangeError.name || null,
    });
    return noStoreRedirect(origin, `/login?error=${encodeURIComponent('Google sign-in could not complete its secure callback. Please try again from this page.')}&next=${encodeURIComponent(next)}`);
  }

  // Verifying the new session and creating the app-specific session token
  // on a SECOND request prevents OAuth's first redirect from racing cookie
  // propagation in browsers on Android and desktop.
  console.info('[Auth] Google callback exchanged code', {
    authCookieWriteObserved,
    callbackHost: requestUrl.host,
  });
  return response;
}
