import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createServiceClient } from './supabase/service';

export async function getOrCreateProfile(supabase: SupabaseClient, user: User) {
  const existing = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existing.error || existing.data) return existing;

  try {
    const service = createServiceClient();
    const created = await service
      .from('profiles')
      .insert({
        id: user.id,
        name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : null,
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
