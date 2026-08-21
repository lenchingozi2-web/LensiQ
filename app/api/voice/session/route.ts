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

  if (action === 'heartbeat') {
    const { error } = await supabase
      .from('live_class_sessions')
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'active');
    if (error) return NextResponse.json({ error: 'Unable to update the Live Class session.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from('live_class_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString(), last_heartbeat_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (error) return NextResponse.json({ error: 'Unable to close the Live Class session.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
