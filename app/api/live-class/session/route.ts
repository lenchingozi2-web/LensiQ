import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { subscriptionsEnabled } from '@/lib/subscriptions';
import { includesLiveClass } from '@/lib/plans';
import { reserveOpenClass, updateOpenClass, OPEN_CLASS_PREFIX } from '@/lib/subscription-runtime';
import { purgeSessionMaterialsOnEnd } from '@/lib/rag/ephemeral-cleanup';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to start Live Class.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();
  if (!admin) { console.error('Session route: Supabase admin client unavailable'); return NextResponse.json({ error: 'Session route HTTP 503: Supabase admin client unavailable' }, { status: 503 }); }
  if (subscriptionsEnabled()) {
    await db.rpc('refresh_my_subscription');
    const { data: profile } = await db.from('profiles').select('role,plan,plan_expires_at').eq('id', user.id).maybeSingle();
    const paid = Boolean(profile?.plan && profile.plan !== 'free' && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date()));
    if (profile?.role !== 'admin' && (!paid || !includesLiveClass(profile?.plan))) return NextResponse.json({ error: 'Live Class is included with Scholar, Scholar Plus and Mastery.' }, { status: 403 });
  }
  const courseName = typeof body.courseName === 'string' && body.courseName.trim() ? body.courseName.trim().slice(0, 120) : 'Live Class';
  const syllabusId = typeof body.syllabusId === 'string' ? body.syllabusId : null;
  const roomName = `${subscriptionsEnabled() ? 'lensiq-direct-' : OPEN_CLASS_PREFIX}${user.id.slice(0, 8)}-${crypto.randomUUID()}`;
  const reservation = !subscriptionsEnabled()
    ? await reserveOpenClass(admin, user.id, roomName, courseName, typeof body.conversationId === 'string' ? body.conversationId : null)
    : await db.rpc('reserve_live_class_session', { p_room_name: roomName, p_course_name: courseName, p_conversation_id: body.conversationId || null });
  const quota = Array.isArray(reservation.data) ? reservation.data[0] : reservation.data;
  if (reservation.error || !quota) { console.error('Session reservation failed', reservation.error?.code, reservation.error?.message); return NextResponse.json({ error: 'Session route HTTP 503: reservation failed' + (reservation.error?.code ? ' (database ' + reservation.error.code + ')' : '') }, { status: 503 }); }
  if (!quota.allowed) return NextResponse.json({ error: 'live_class_limit', message: 'Your Live Class allowance is unavailable right now.', quota }, { status: 403 });
  const sessionId = String(quota.session_id);
  const maxDurationSeconds = Math.min(90 * 60, Math.max(60, Number(quota.max_duration_seconds ?? 90 * 60)));
  const expiresAt = new Date(Date.now() + maxDurationSeconds * 1000).toISOString();
  if (syllabusId) {
    const linked = await admin.from('study_syllabi').update({ session_id: sessionId, expires_at: expiresAt })
      .eq('id', syllabusId).eq('user_id', user.id).is('session_id', null).in('status', ['compiling', 'ready']).gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
    if (linked.error || !linked.data) {
      if (subscriptionsEnabled()) await db.rpc('charge_live_class_session', { p_session_id: sessionId, p_duration_seconds: 0, p_end: true });
      else await updateOpenClass(admin, user.id, sessionId, true);
      console.error('Session syllabus link failed', linked.error?.code, linked.error?.message);
      return NextResponse.json({ error: 'syllabus_unavailable', message: 'Session route HTTP 409: syllabus unavailable or already linked', resetSyllabus: true }, { status: 409 });
    }
  }
  return NextResponse.json({ ok: true, sessionId, roomName, expiresAt, quota: { ...quota, maxDurationSeconds, expiresAt } });
  } catch (error) {
    console.error('Session route HTTP 500', error);
    return NextResponse.json({ error: 'Session route HTTP 500: unable to create the classroom; check server logs' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  const admin = createAdminClient();
  if (!admin || !sessionId) return NextResponse.json({ error: 'Session is required.' }, { status: 400 });
  const owned = await admin.from('live_class_sessions').select('room_name').eq('id', sessionId).eq('user_id', user.id).maybeSingle();
  if (!owned.data) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  const result = (!subscriptionsEnabled() || owned.data.room_name.startsWith(OPEN_CLASS_PREFIX))
    ? await updateOpenClass(admin, user.id, sessionId, true)
    : await db.rpc('charge_live_class_session', { p_session_id: sessionId, p_duration_seconds: Number(body.durationSeconds) || 0, p_end: true });
  if (result.error) return NextResponse.json({ error: 'Unable to end the class.' }, { status: 500 });
  let purged = 0;
  try { purged = (await purgeSessionMaterialsOnEnd(admin, user.id, sessionId)).length; } catch (error) { console.warn('Direct class cleanup pending', error); }
  return NextResponse.json({ ok: true, purgedSyllabi: purged });
}
