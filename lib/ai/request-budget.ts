import { randomUUID } from 'node:crypto';
import { createAdminClient } from '../supabase/admin';
import { evaluateAiBudgetAlerts } from './budget-alerts';

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

  // The database-backed admin switch is the single global pause control.
  const { data: controls, error: controlError } = await admin
    .from('ai_runtime_controls')
    .select('is_paused')
    .eq('id', 1)
    .maybeSingle();
  if (controlError || !controls || controls.is_paused !== false) {
    return { allowed: false, reason: 'ai_globally_paused' };
  }
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

  // Usage events contain operational metadata only, never prompt content.
  const eventStatus = row.allowed ? 'reserved' : 'denied';
  const eventResult = await admin.from('ai_usage_events').insert({
    request_id: reservationId,
    user_id: userId,
    feature,
    provider: 'deepseek',
    model: feature === 'teach' ? (process.env.DEEPSEEK_TEACHING_MODEL || 'deepseek-v4-flash') : (process.env.DEEPSEEK_EXPLAIN_MODEL || 'deepseek-v4-flash'),
    status: eventStatus,
    estimated_cost_microusd: Number(row.reserved_microusd || 0),
    error_code: row.allowed ? null : (row.reason || 'budget_denied'),
  });
  if (eventResult.error) {
    console.error('AI usage event write failed', { code: eventResult.error.code || 'unknown' });
    return { allowed: false, reason: 'usage_logging_unavailable' };
  }
  if (!(await evaluateAiBudgetAlerts(admin))) {
    return { allowed: false, reason: 'budget_alert_monitor_unavailable' };
  }

  if (!row.allowed) return { allowed: false, reason: row.reason || 'budget_unavailable' };

  return {
    allowed: true,
    reservedUsd: Number(row.reserved_microusd || 0) / 1_000_000,
  };
}
