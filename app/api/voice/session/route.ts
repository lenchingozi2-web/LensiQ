import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
  const action = body?.action === 'end' || body?.action === 'heartbeat' || body?.action === 'link' ? body.action : '';
  const conversationId = typeof body?.conversationId === 'string' && body.conversationId.trim() ? body.conversationId.trim() : null;
  const durationSeconds = Number.isFinite(Number(body?.durationSeconds)) ? Math.max(0, Math.floor(Number(body.durationSeconds))) : 0;

  if (!sessionId || !action) return NextResponse.json({ error: 'Session and action are required.' }, { status: 400 });

  if (action === 'link') {
    if (!conversationId) return NextResponse.json({ error: 'Conversation is required.' }, { status: 400 });
    const { error } = await supabase
      .from('live_class_sessions')
      .update({ conversation_id: conversationId, last_heartbeat_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: 'Unable to link the Live Class history.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: chargeRows, error: chargeError } = await supabase.rpc('charge_live_class_session', {
    p_session_id: sessionId,
    p_duration_seconds: durationSeconds,
    p_end: action === 'end',
  });
  const charge = Array.isArray(chargeRows) ? chargeRows[0] : chargeRows;
  if (chargeError || !charge) return NextResponse.json({ error: 'Unable to update the Live Class wallet usage.' }, { status: 500 });
  if (!charge.ok && charge.reason === 'session_not_found') return NextResponse.json({ error: 'Live Class session not found.' }, { status: 404 });
  if (!charge.ok) return NextResponse.json({ error: 'Unable to update the Live Class wallet usage.' }, { status: 500 });

  if (action === 'heartbeat' && !charge.should_end) {
    const { error } = await supabase
      .from('live_class_sessions')
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'active');
    if (error) return NextResponse.json({ error: 'Unable to update the Live Class session.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    remainingVoiceMinutes: charge.remaining_voice_minutes ?? null,
    shouldEnd: Boolean(charge.should_end),
    chargedMinutes: charge.charged_minutes ?? 0,
    message: charge.should_end ? 'Your voice-minute balance has reached zero. The Live Class has ended gracefully.' : null,
  });
}
