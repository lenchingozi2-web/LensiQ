import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { evaluateAiBudgetAlerts } from '../../../../lib/ai/budget-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function authorized(request: Request): boolean {
  const expected = process.env.AI_BUDGET_INTERNAL_TOKEN;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

/**
 * Internal-only budget reservation endpoint for trusted workers such as the
 * Modal/Pipecat voice agent. The shared token must be provisioned in Vercel and
 * the worker secret manager; it is never sent to a browser.
 */
export async function POST(request: Request) {
  if (!process.env.AI_BUDGET_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'AI budget service is not configured.' }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const length = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > 2048) {
    return NextResponse.json({ error: 'Invalid budget request.' }, { status: 413 });
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > 2048) {
    return NextResponse.json({ error: 'Invalid budget request.' }, { status: 413 });
  }

  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = null;
  }
  if (
    !body ||
    !validUuid(body.userId) ||
    !validUuid(body.requestId) ||
    !['teach', 'explain', 'voice'].includes(String(body.feature)) ||
    (body.action === 'lease' && (body.feature !== 'voice' || !validUuid(body.sessionId) || !Number.isInteger(body.turns) || Number(body.turns) < 1 || Number(body.turns) > 128))
  ) {
    return NextResponse.json({ error: 'Invalid budget request.' }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'AI budget service is not configured.' }, { status: 503 });
  }

  const isVoice = body.feature === 'voice';
  const isLease = isVoice && body.action === 'lease';
  if (isLease) {
    // Bind a trusted worker's request to an actual active, paid session.
    const { data: session, error: sessionError } = await admin.from('live_class_sessions')
      .select('id, user_id, started_at, status').eq('id', body.sessionId)
      .eq('user_id', body.userId).eq('status', 'active').maybeSingle();
    if (sessionError || !session || Date.now() >= new Date(session.started_at).getTime() + 90 * 60_000) {
      return NextResponse.json({ allowed: false, reason: 'session_ended' }, { status: 403 });
    }
  }
  let reservation = isLease
    ? await admin.rpc('reserve_live_class_ai_lease', {
        p_user_id: body.userId,
        p_session_id: body.sessionId,
        p_request_id: body.requestId,
        p_turns: body.turns,
      })
    : isVoice
      ? await admin.rpc('reserve_live_class_ai_request', { p_user_id: body.userId, p_request_id: body.requestId })
      : await admin.rpc('reserve_ai_budget', {
          p_user_id: body.userId, p_feature: body.feature, p_request_id: body.requestId,
        });
  // Backward-compatible rollout: keep the classroom available while 0050 is
  // awaiting access to the medical Supabase project. This charges one legacy
  // voice reservation per 15-minute lease, not one network call per sentence.
  let legacyLease = false;
  if (isLease && ['42883', 'PGRST202'].includes(reservation.error?.code || '')) {
    legacyLease = true;
    reservation = await admin.rpc('reserve_live_class_ai_request', {
      p_user_id: body.userId, p_request_id: body.requestId,
    });
  }
  const { data, error } = reservation;

  if (error) {
    console.error('Internal AI budget reservation failed', {
      code: error.code || 'unknown',
      message: (error.message || 'unknown').slice(0, 240),
    });
    return NextResponse.json({ error: 'AI budget service is unavailable.' }, { status: 503 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as {
    allowed?: boolean;
    reason?: string | null;
    reserved_microusd?: number | string | null;
  } | null;

  if (!row || typeof row.allowed !== 'boolean') {
    return NextResponse.json({ error: 'AI budget service is unavailable.' }, { status: 503 });
  }

  const usageEvent = await admin.from('ai_usage_events').insert({
    request_id: body.requestId,
    user_id: body.userId,
    feature: body.feature,
    provider: 'voice-configured',
    status: row.allowed ? 'reserved' : 'denied',
    estimated_cost_microusd: Number(row.reserved_microusd || 0),
    error_code: row.allowed ? null : (row.reason || 'budget_denied'),
  });
  if (usageEvent.error) {
    console.error('Voice budget event write failed', { code: usageEvent.error.code || 'unknown' });
    return NextResponse.json({ error: 'AI usage logging unavailable; failing closed.' }, { status: 503 });
  }
  if (!isVoice && !(await evaluateAiBudgetAlerts(admin))) {
    return NextResponse.json({ error: 'AI budget alert monitoring unavailable; failing closed.' }, { status: 503 });
  }

  return NextResponse.json({
    allowed: row.allowed,
    reason: row.reason || null,
    reservedUsd: Number(row.reserved_microusd || 0) / 1_000_000,
    ...(isLease && row.allowed ? { leaseTurns: Number(body.turns), leaseSeconds: 15 * 60, legacyLease } : {}),
  }, { status: row.allowed ? 200 : row.reason === 'duplicate_request' ? 409 : 429 });
}
