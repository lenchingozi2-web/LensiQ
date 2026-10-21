import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const activeSessionCookie = 'session_token';
const sessionCheckTimeoutMs = 5000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), sessionCheckTimeoutMs);

  return fetch(input, {
    ...init,
    signal: init?.signal ?? controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}

function sessionReplacedResponse(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login?reason=session_replaced', request.url));

  for (const cookie of request.cookies.getAll()) {
    if (cookie.name === activeSessionCookie || cookie.name.startsWith('sb-')) {
      response.cookies.delete(cookie.name);
    }
  }

  return response;
}

export async function middleware(request: NextRequest) {
  // The callback must exchange the OAuth code and set the session cookies
  // before middleware attempts to validate the authenticated request.
  if (request.nextUrl.pathname === '/auth/callback') {
    return NextResponse.next();
  }

  // Allow the site to render a recoverable page if deployment configuration is
  // temporarily incomplete instead of throwing an Edge runtime error.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Middleware] Missing Supabase environment variables.');
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      global: {
        fetch: fetchWithTimeout,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options });
          });

          response = NextResponse.next({ request: { headers: request.headers } });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    });

    // This refreshes an expiring Supabase session and writes rotated cookies
    // through the response without treating a transient error as a logout.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!authError && user) {
      const activeToken = request.cookies.get(activeSessionCookie)?.value;
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('session_token')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        // A temporary database failure must not kick out a valid Supabase user.
        console.error('[Middleware] Active-session lookup failed:', profileError.message);
      } else if (activeToken && profile?.session_token && profile.session_token !== activeToken) {
        return sessionReplacedResponse(request);
      }
    }
  } catch (error) {
    // Fail open for transient network/service failures. Protected server pages
    // still enforce authentication when they can verify the request.
    console.error('[Middleware] Supabase session check failed:', error);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
