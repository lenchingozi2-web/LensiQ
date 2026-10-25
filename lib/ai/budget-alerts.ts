import type { SupabaseClient } from '@supabase/supabase-js';

const usd = (microusd: number) => microusd / 1_000_000;

function utcDayStart(date: Date): string {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value.toISOString();
}

export async function evaluateAiBudgetAlerts(admin: SupabaseClient): Promise<boolean> {
  const now = new Date();
  const dayStart = utcDayStart(now);
  const monthDate = new Date(now);
  monthDate.setUTCDate(1);
  const monthStart = utcDayStart(monthDate);
  const [controlsResult, dayResult, monthResult] = await Promise.all([
    admin.from('ai_runtime_controls').select('global_daily_limit_microusd, global_monthly_limit_microusd').eq('id', 1).maybeSingle(),
    admin.from('ai_spend_windows').select('reserved_microusd').eq('window_start', dayStart).eq('scope_key', 'global:day').maybeSingle(),
    admin.from('ai_spend_windows').select('reserved_microusd').eq('window_start', monthStart).eq('scope_key', 'global:month').maybeSingle(),
  ]);
  if (controlsResult.error || dayResult.error || monthResult.error || !controlsResult.data) {
    console.error('AI budget alert evaluation unavailable', {
      code: controlsResult.error?.code || dayResult.error?.code || monthResult.error?.code || 'missing_controls',
    });
    return false;
  }

  const daySpend = Number(dayResult.data?.reserved_microusd ?? 0);
  const monthSpend = Number(monthResult.data?.reserved_microusd ?? 0);
  const current = [
    { name: 'global_daily', label: 'Global daily reserved budget', observed: daySpend, cap: Number(controlsResult.data.global_daily_limit_microusd), period: now.toISOString().slice(0, 10) },
    { name: 'global_monthly', label: 'Global monthly reserved budget', observed: monthSpend, cap: Number(controlsResult.data.global_monthly_limit_microusd), period: now.toISOString().slice(0, 7) },
  ];

  for (const item of current) {
    for (const [percent, level] of [[50, 'warning'], [80, 'critical'], [100, 'critical']] as const) {
      const key = `${item.name}_${percent}_${item.period}`;
      const threshold = Math.floor(item.cap * percent / 100);
      if (item.observed < threshold) continue;

      const previous = await admin.from('ai_budget_alerts').select('active').eq('alert_key', key).maybeSingle();
      if (previous.error) {
        console.error('AI budget alert lookup failed', { code: previous.error.code || 'unknown' });
        return false;
      }
      const saved = await admin.from('ai_budget_alerts').upsert({
        alert_key: key,
        level,
        metric: item.label,
        observed_microusd: item.observed,
        threshold_microusd: threshold,
        active: true,
        last_seen_at: now.toISOString(),
        resolved_at: null,
      }, { onConflict: 'alert_key' });
      if (saved.error) {
        console.error('AI budget alert persistence failed', { code: saved.error.code || 'unknown' });
        return false;
      }

      if ((!previous.data || previous.data.active === false) && process.env.AI_BUDGET_ALERT_WEBHOOK_URL) {
        try {
          const response = await fetch(process.env.AI_BUDGET_ALERT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              source: 'LensiQ AI budget monitor',
              alert: { key, level, metric: item.label, observedUsd: usd(item.observed), thresholdUsd: usd(threshold), at: now.toISOString() },
            }),
            signal: AbortSignal.timeout(3000),
          });
          if (!response.ok) console.error('AI budget alert webhook returned non-success', { status: response.status });
        } catch {
          console.error('AI budget alert webhook failed');
        }
      }
    }
  }
  return true;
}
