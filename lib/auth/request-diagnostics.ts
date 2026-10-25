type AuthErrorInfo = {
  code?: string;
  status?: number;
  name?: string;
} | null | undefined;

/** Log enough metadata to diagnose rejected same-site auth requests without ever logging cookie/token values. */
export function logAuthRequestRejection(request: Request, route: string, error: AuthErrorInfo): void {
  const rawCookieHeader = request.headers.get('cookie') || '';
  const cookieNames = rawCookieHeader
    .split(';')
    .map((part) => part.split('=', 1)[0]?.trim() || '')
    .filter(Boolean);
  const hasSupabaseSessionCookie = cookieNames.some((name) =>
    name.startsWith('sb-') && name.includes('-auth-token') && !name.includes('code-verifier'),
  );
  const hasPkceCookie = cookieNames.some((name) => name.startsWith('sb-') && name.includes('code-verifier'));
  let originHost: string | null = null;
  try {
    originHost = request.headers.get('origin') ? new URL(request.headers.get('origin')!).host : null;
  } catch {
    originHost = 'invalid-origin';
  }

  console.error('[AuthDiag] Authenticated route rejected request', {
    route,
    host: request.headers.get('host') || null,
    originHost,
    hasSupabaseSessionCookie,
    hasPkceCookie,
    hasActiveSessionCookie: cookieNames.includes('session_token'),
    authErrorCode: error?.code || null,
    authErrorStatus: typeof error?.status === 'number' ? error.status : null,
    authErrorName: error?.name || null,
  });
}
