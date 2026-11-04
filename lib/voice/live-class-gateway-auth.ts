import { createHmac, timingSafeEqual } from 'node:crypto';

type SessionClaim = {
  v: 1;
  room: string;
  session: string;
  user: string;
  expires: number;
};

function signature(secret: string, encoded: string): string {
  return createHmac('sha256', secret)
    .update('lenxiq-live-class-gateway-v1.' + encoded)
    .digest('base64url');
}

/** Server-generated, per-class bearer; never sent to the learner's browser. */
export function issueLiveClassGatewayToken(
  secret: string,
  details: { roomName: string; sessionId: string; userId: string; expiresAt: string },
): string {
  const expires = Math.floor(new Date(details.expiresAt).getTime() / 1000);
  if (!Number.isFinite(expires) || expires <= Date.now() / 1000 ||
      expires > Date.now() / 1000 + 95 * 60) {
    throw new Error('Invalid Live Class gateway expiry');
  }
  const claims: SessionClaim = {
    v: 1, room: details.roomName, session: details.sessionId,
    user: details.userId, expires,
  };
  const encoded = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return encoded + '.' + signature(secret, encoded);
}

/** Timing-safe verification and hard expiry. The caller must also verify the DB session. */
export function verifyLiveClassGatewayToken(
  secret: string,
  authorization: string | null,
): SessionClaim | null {
  if (!secret || !authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7);
  const match = /^([a-zA-Z0-9_-]{40,3000})\.([a-zA-Z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  const expected = Buffer.from(signature(secret, match[1]), 'utf8');
  const received = Buffer.from(match[2], 'utf8');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  let claims: Partial<SessionClaim>;
  try {
    claims = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8')) as Partial<SessionClaim>;
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (claims.v !== 1 ||
      typeof claims.room !== 'string' || !/^lensiq-voice-[a-z0-9-]{12,100}$/.test(claims.room) ||
      typeof claims.session !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.session) ||
      typeof claims.user !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.user) ||
      typeof claims.expires !== 'number' ||
      !Number.isInteger(claims.expires) || claims.expires <= now ||
      claims.expires > now + 95 * 60) return null;
  return claims as SessionClaim;
}
