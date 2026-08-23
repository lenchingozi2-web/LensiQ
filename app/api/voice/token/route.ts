import { NextResponse } from 'next/server';
import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';
import { createClient } from '../../../../lib/supabase/server';
import { buildLiveClassSeed } from '../../../../lib/ai/live-class-context';

function normalizeLiveKitUrl(value: string) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');
  const withWebSocketProtocol = trimmed.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  const candidate = /^wss?:\/\//i.test(withWebSocketProtocol) ? withWebSocketProtocol : `wss://${withWebSocketProtocol}`;
  const parsed = new URL(candidate);
  if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new Error('LIVEKIT_URL must use ws:// or wss://.');

  if (!parsed.hostname.includes('.') && !parsed.hostname.includes(':')) {
    parsed.hostname = `${parsed.hostname}.livekit.cloud`;
  }

  return parsed.toString().replace(/\/$/, '');
}

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const courseName = typeof body?.courseName === 'string' && body.courseName.trim() ? body.courseName.trim().slice(0, 120) : 'Live Class';
  const topicFocus = typeof body?.topicFocus === 'string' && body.topicFocus.trim() ? body.topicFocus.trim().slice(0, 300) : '';
  const conversationId = typeof body?.conversationId === 'string' && body.conversationId.trim() ? body.conversationId.trim() : null;
  const roomName = `lensiq-voice-${user.id.slice(0, 8)}-${crypto.randomUUID()}`;

  const { data: reservation, error: reservationError } = await supabase.rpc('reserve_live_class_session', {
    p_room_name: roomName,
    p_course_name: courseName,
    p_conversation_id: conversationId,
  });
  const quota = Array.isArray(reservation) ? reservation[0] : reservation;

  if (reservationError || !quota) {
    console.error('Live Class reservation failed:', reservationError);
    return NextResponse.json({ error: 'Unable to reserve a Live Class session right now. Please try again.' }, { status: 500 });
  }

  if (!quota.allowed) {
    const limitMessage = quota.reason === 'limit_reached'
      ? 'Your Foundation Scholar plan includes 3 Live Class sessions per calendar month, with each session lasting up to 10 minutes. Premium adds 60 voice minutes each billing month.'
      : quota.reason === 'voice_balance_empty'
        ? 'Your Premium voice-minute balance is empty. Top up voice minutes to continue with Live Class.'
        : quota.reason === 'active_session'
          ? 'You already have an active Live Class. End it before starting another one.'
          : 'Sign in to start Live Class.';
    return NextResponse.json({
      error: 'live_class_limit',
      message: limitMessage,
      quota: {
        isUnlimited: false,
        usedSessions: quota.used_sessions ?? 3,
        maxSessions: quota.max_sessions ?? 3,
        maxDurationSeconds: quota.max_duration_seconds ?? 600,
        resetsAt: quota.expires_at,
      },
    }, { status: 403 });
  }

  const isUnlimited = Boolean(quota.is_unlimited);
  const maxDurationSeconds = isUnlimited ? 86400 : Math.max(60, Number(quota.max_duration_seconds ?? 600));
  const evidenceSeed = await buildLiveClassSeed(supabase, courseName, topicFocus);
  const dispatchHost = livekitUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
  const dispatchMetadata = JSON.stringify({
    userId: user.id,
    courseName,
    topicFocus,
    sessionType: 'live_class',
    contextEndpoint: `${new URL(req.url).origin}/api/voice/context`,
    evidenceSeed,
  });
  try {
    const dispatchClient = new AgentDispatchClient(dispatchHost, apiKey, apiSecret);
    await dispatchClient.createDispatch(roomName, 'lensiq-voice-tutor', { metadata: dispatchMetadata });
  } catch (dispatchError) {
    console.error('Live Class agent dispatch failed:', dispatchError);
    return NextResponse.json({ error: 'The Live Class tutor could not be dispatched. Please try again.' }, { status: 503 });
  }
  const token = new AccessToken(apiKey, apiSecret, {
    identity: user.id,
    name: user.email ?? 'LenxiQ AI learner',
    metadata: dispatchMetadata,
    ttl: isUnlimited ? '24h' : `${maxDurationSeconds}s`,
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
    sessionId: quota.session_id,
    expiresInSeconds: maxDurationSeconds,
    quota: {
      isUnlimited,
      usedSessions: quota.used_sessions ?? null,
      maxSessions: quota.max_sessions ?? null,
      maxDurationSeconds: quota.max_duration_seconds ?? maxDurationSeconds,
      expiresAt: quota.expires_at ?? null,
      resetsAt: isUnlimited ? null : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
    },
  });
}
