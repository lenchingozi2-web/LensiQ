import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createAdminClient } from './supabase/admin';
import { subscriptionsEnabled } from './subscriptions';

/** Call only after auth.getUser() succeeded. Every private query still needs its owner filter. */
export function authenticatedStudyClient(client: SupabaseClient, user: Pick<User, 'id'>): SupabaseClient {
  if (!user.id) throw new Error('Authentication required.');
  if (subscriptionsEnabled()) return client;
  const service = createAdminClient();
  if (!service) throw new Error('Authenticated study access is unavailable.');
  // Existing paid RLS remains intact. The server bypass is limited to routes
  // which verify the caller and explicitly scope private records to that user.
  return service;
}

export const CLASS_SESSION_SECONDS = 90 * 60;
export const OPEN_CLASS_PREFIX = 'lensiq-open-';
export function classSessionIsCurrent(startedAt: string, now = Date.now()): boolean {
  const started = Date.parse(startedAt);
  return Number.isFinite(started) && started <= now + 5000 && now < started + CLASS_SESSION_SECONDS * 1000;
}

export async function classGatewayAllowed(db: SupabaseClient, session: { id: string; started_at: string; room_name: string; status?: string }, userId: string) {
  if (!classSessionIsCurrent(session.started_at) || (session.status && session.status !== 'active')) return false;
  if (!subscriptionsEnabled()) return true;
  // An open-access session must never be charged retroactively after billing resumes.
  if (session.room_name.startsWith(OPEN_CLASS_PREFIX)) return false;
  const { data, error } = await db.rpc('live_class_gateway_allowed', { p_session: session.id, p_user: userId });
  return !error && data === true;
}

export async function reserveOpenClass(db: SupabaseClient, userId: string, roomName: string, courseName: string, conversationId: string | null) {
  if (subscriptionsEnabled()) throw new Error('Open-access reservations are disabled.');
  if (!roomName.startsWith(OPEN_CLASS_PREFIX)) throw new Error('Invalid open-access room.');
  if (conversationId) {
    const owned = await db.from('teaching_conversations').select('id').eq('id', conversationId)
      .eq('user_id', userId).eq('session_type', 'live_class').is('deleted_at', null).maybeSingle();
    if (owned.error || !owned.data) return { data: null, error: { code: 'OWNERSHIP_REQUIRED', message: 'Live Class conversation not found.' } };
  }
  const created = await db.from('live_class_sessions').insert({
    user_id: userId, room_name: roomName, course_name: courseName, conversation_id: conversationId,
    voice_reserved_minutes: 90, is_free_trial: false,
  }).select('id,started_at').single();
  if (created.error || !created.data) return { data: null, error: created.error };
  const row = created.data;
  // Database-generated start times plus ID order make the newest reservation
  // win, including overlapping requests. Never close a newer concurrent room.
  const latest = await db.from('live_class_sessions').select('id').eq('user_id', userId).eq('status', 'active')
    .order('started_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (latest.error || latest.data?.id !== row.id) {
    await db.from('live_class_sessions').update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', row.id).eq('user_id', userId);
    return { data: { allowed: false, reason: 'active_session' }, error: latest.error };
  }
  const closed = await db.from('live_class_sessions').update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('user_id', userId).eq('status', 'active').neq('id', row.id)
    .or(`started_at.lt.${row.started_at},and(started_at.eq.${row.started_at},id.lt.${row.id})`);
  if (closed.error) {
    await db.from('live_class_sessions').update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', row.id).eq('user_id', userId);
    return { data: null, error: closed.error };
  }
  return { data: { allowed: true, reason: 'full_access', session_id: row.id,
    max_duration_seconds: CLASS_SESSION_SECONDS, is_unlimited: true,
    expires_at: new Date(Date.parse(row.started_at) + CLASS_SESSION_SECONDS * 1000).toISOString() }, error: null };
}

export async function updateOpenClass(db: SupabaseClient, userId: string, sessionId: string, end: boolean) {
  const owned = await db.from('live_class_sessions').select('id,status,started_at,room_name')
    .eq('id', sessionId).eq('user_id', userId).maybeSingle();
  if (owned.error) return { data: null, error: owned.error };
  if (!owned.data) return { data: { ok: false, reason: 'session_not_found' }, error: null };
  const row = owned.data;
  if (subscriptionsEnabled() && !row.room_name.startsWith(OPEN_CLASS_PREFIX)) throw new Error('Use metered session accounting.');
  const expired = !classSessionIsCurrent(row.started_at);
  const resumed = subscriptionsEnabled();
  const shouldEnd = end || expired || resumed || row.status !== 'active';
  const now = new Date().toISOString();
  const updated = await db.from('live_class_sessions').update(shouldEnd
    ? { status: expired ? 'expired' : 'ended', ended_at: now, last_heartbeat_at: now }
    : { last_heartbeat_at: now }).eq('id', sessionId).eq('user_id', userId).eq('status', 'active');
  return { data: updated.error ? null : { ok: true, remaining_voice_minutes: null, charged_minutes: 0,
    should_end: shouldEnd, reason: expired ? 'session_time_limit' : resumed ? 'subscriptions_resumed' : shouldEnd ? 'session_ended' : null }, error: updated.error };
}

/** Storage paths from requests or editable metadata must never cross owners. */
export function ownedStoragePath(userId: string, path: unknown): path is string {
  if (typeof path !== 'string' || !path.startsWith(userId + '/') || path.length > 800 || /[\\%?#\u0000-\u001f]/.test(path)) return false;
  return path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}
