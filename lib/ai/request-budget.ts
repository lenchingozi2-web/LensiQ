import { randomUUID } from 'node:crypto';
import { createAdminClient } from '../supabase/admin';

type BudgetResult = {
  allowed: boolean;
  reason: string | null;
  reserved_microusd: number | null;
};

/**
 * Reserve request and dollar-denominated budget atomically in Postgres before
 * any paid provider call. The privileged RPC is not callable by browser users.
 * Failed provider calls are intentionally not refunded automatically: an
 * upstream timeout does not prove the provider did not process the request.
 */
export async function reserveAiRequest(
  userId: string,
  feature: 'teach' | 'explain',
  requestId?: string,
): Promise<{ allowed: boolean; reason?: string; reservedUsd?: number }> {
  const admin = createAdminClient();
  if (!admin) return { allowed: false, reason: 'budget_unavailable' };

  const reservationId = requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    ? requestId
    : randomUUID();
  const { data, error } = await admin.rpc('reserve_ai_budget', {
    p_user_id: userId,
    p_feature: feature,
    p_request_id: reservationId,
  });

  if (error) {
    // Never log request bodies, provider responses, credentials, or user data.
    console.error('AI budget reservation failed', { code: error.code || 'unknown' });
    return { allowed: false, reason: 'budget_unavailable' };
  }

  const row = (Array.isArray(data) ? data[0] : data) as BudgetResult | null;
  if (!row || typeof row.allowed !== 'boolean') {
    return { allowed: false, reason: 'budget_unavailable' };
  }
  if (!row.allowed) return { allowed: false, reason: row.reason || 'budget_unavailable' };

  return {
    allowed: true,
    reservedUsd: Number(row.reserved_microusd || 0) / 1_000_000,
  };
}
