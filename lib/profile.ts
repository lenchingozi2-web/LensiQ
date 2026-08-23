import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createServiceClient } from './supabase/service';

export async function getOrCreateProfile(supabase: SupabaseClient, user: User) {
  const profileName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : null;

  // The security-definer RPC is the primary path. It can read/repair the profile
  // without depending on a user-scoped SELECT policy or a Vercel service key.
  const provisioned = await supabase.rpc('ensure_user_profile', {
    p_name: profileName,
    p_email: user.email ?? null,
  });
  if (!provisioned.error && provisioned.data) {
    const profile = Array.isArray(provisioned.data) ? provisioned.data[0] : provisioned.data;
    if (profile) return { data: profile, error: null };
  }

  const existing = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (!existing.error && existing.data) return existing;

  // Compatibility fallback for an older deployment where the RPC has not yet
  // been applied. This path never updates an existing row.
  try {
    const service = createServiceClient();
    const created = await service
      .from('profiles')
      .insert({
        id: user.id,
        name: profileName,
        email: user.email ?? null,
        role: 'user',
        plan: 'free',
        plan_duration: 0,
        ai_teachings_used: 0,
        ai_explanations_used: 0,
        quiz_attempts_used: 0,
        voice_minutes_balance: 0,
        text_teaching_balance: 0,
        storage_limit_bytes: 100 * 1024 * 1024,
      })
      .select('*')
      .single();
    if (!created.error || created.error.code !== '23505') return created;
    return await service
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
  } catch (error) {
    console.error('Profile bootstrap failed:', error);
    return { data: null, error: { message: 'Profile bootstrap is unavailable.' } };
  }
}
