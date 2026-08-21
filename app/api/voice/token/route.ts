import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '../../../../lib/supabase/server';

function normalizeLiveKitUrl(value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');
  const withWebSocketProtocol = trimmed.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  const candidate = /^wss?:\/\//i.test(withWebSocketProtocol) ? withWebSocketProtocol : `wss://${withWebSocketProtocol}`;
  const parsed = new URL(candidate);
  if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new Error('LIVEKIT_URL must use ws:// or wss://.');

  // LiveKit Cloud credentials are sometimes supplied as only the project
  // subdomain (for example, `abc123`) rather than the full host. A bare host
  // cannot resolve in the browser; normalize it to the public Cloud endpoint
  // while preserving fully-qualified/custom WebSocket URLs unchanged.
  if (!parsed.hostname.includes('.') && !parsed.hostname.includes(':')) {
    parsed.hostname = `${parsed.hostname}.livekit.cloud`;
  }

  return parsed.toString().replace(/\/$/, '');
}

export async function POST() {
  const rawLivekitUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!rawLivekitUrl || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Voice tutoring is not configured yet. Please check the LiveKit server settings.' }, { status: 503 });
  }

  let livekitUrl: string;
  try {
    livekitUrl = normalizeLiveKitUrl(rawLivekitUrl);
  } catch {
    return NextResponse.json({ error: 'The LiveKit server URL is invalid. It must be a LiveKit ws:// or wss:// endpoint.' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const roomName = `lensiq-voice-${user.id.slice(0, 8)}-${crypto.randomUUID()}`;
  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.email ?? 'lensiqAI learner',
    ttl: '10m',
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: livekitUrl,
    roomName,
    expiresInSeconds: 600,
  });
}
