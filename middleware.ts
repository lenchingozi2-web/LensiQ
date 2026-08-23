import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const activeSessionCookie = 'session_token';

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
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: '', ...options });
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
      } else if (profile?.session_token && profile.session_token !== activeToken) {
        return sessionReplacedResponse(request);
      }
    } else if (authError) {
      // Supabase remains the authority for genuine authentication failures. Do
      // not delete cookies here: the next request may refresh successfully.
      console.warn('[Middleware] Supabase session check did not complete:', authError.message);
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
