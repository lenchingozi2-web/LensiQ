import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { isPaidPlan } from '../../../lib/plans';

const DEFAULT_STORAGE_LIMIT = 100 * 1024 * 1024;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, plan, plan_expires_at, wallet_reset_at, voice_minutes_balance, text_teaching_balance, storage_limit_bytes')
    .eq('id', user.id)
    .single();
  if (error || !profile) return NextResponse.json({ error: 'Unable to load wallet.' }, { status: 500 });

  const { data: storageBytes, error: storageError } = await supabase.rpc('get_user_teaching_storage_bytes', { p_user_id: user.id });
  if (storageError) return NextResponse.json({ error: 'Unable to load Teaching storage usage.' }, { status: 503 });

  const activePremium = profile.role === 'admin' || (isPaidPlan(profile.plan) && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date()));
  const { data: events, error: eventsError } = await supabase
    .from('billing_events')
    .select('id,event_type,units,revenue_amount_ngn,created_at,metadata')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (eventsError) return NextResponse.json({ error: 'Unable to load wallet history.' }, { status: 503 });
  const voiceMinutes = Number(profile.voice_minutes_balance ?? 0);
  const textCredits = Number(profile.text_teaching_balance ?? 0);
  const storageUsedBytes = Number(storageBytes ?? 0);
  const storageLimitBytes = Number(profile.storage_limit_bytes ?? DEFAULT_STORAGE_LIMIT);

  return NextResponse.json({
    plan: profile.role === 'admin' ? 'admin' : activePremium ? profile.plan : 'free',
    isAdmin: profile.role === 'admin',
    isPremium: activePremium && profile.role !== 'admin',
    planExpiresAt: profile.plan_expires_at,
    walletResetAt: profile.wallet_reset_at,
    rollover: false,
    voiceMinutes,
    textTeachingCredits: textCredits,
    lowVoiceBalance: activePremium && profile.role !== 'admin' && voiceMinutes <= 5,
    storageUsedBytes,
    storageLimitBytes,
    storageUsedPercent: Math.min(100, Math.round((storageUsedBytes / Math.max(storageLimitBytes, 1)) * 100)),
    events: events ?? [],
  });
}
