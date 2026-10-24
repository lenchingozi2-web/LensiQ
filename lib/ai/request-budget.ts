import type { SupabaseClient } from '@supabase/supabase-js';

type BudgetResult = {
  allowed: boolean;
  reason: string | null;
  user_count: number;
  global_count: number;
};

/**
 * Reserve a provider-call slot in Postgres before making any paid AI request.
 * The RPC uses transaction locks, so parallel serverless requests share limits.
 * Fail closed if the budget table/function is unavailable.
 */
export async function reserveAiRequest(
  supabase: SupabaseClient,
  feature: 'teach' | 'explain',
): Promise<{ allowed: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc('reserve_ai_request', {
    p_feature: feature,
  });

  if (error) {
    console.error('AI request budget reservation failed:', error.message);
    return { allowed: false, reason: 'budget_unavailable' };
  }

  const row = (Array.isArray(data) ? data[0] : data) as BudgetResult | null;
  if (!row?.allowed) return { allowed: false, reason: row?.reason || 'budget_unavailable' };
  return { allowed: true };
}
