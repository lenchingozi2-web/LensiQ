import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { evaluateAiBudgetAlerts } from '../../../../lib/ai/budget-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) };
  const admin = createAdminClient();
  if (!admin) return { response: NextResponse.json({ error: 'Privileged budget database client is not configured.' }, { status: 503 }) };
  return { user, admin };
}

const usd = (microusd: unknown) => Number(microusd ?? 0) / 1_000_000;
const isoDay = (date: Date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

export async function GET() {
  const context = await getAdminContext();
  if ('response' in context) return context.response;
  const { admin } = context;
  const now = new Date();
  const dayStart = isoDay(now);
  const hourDate = new Date(now);
  hourDate.setUTCMinutes(0, 0, 0);
  const hourStart = hourDate.toISOString();
  const minuteDate = new Date(now);
  minuteDate.setUTCSeconds(0, 0);
  const minuteStart = minuteDate.toISOString();
  const monthDate = new Date(now);
  monthDate.setUTCDate(1);
  const monthStart = isoDay(monthDate);

  const [controlResult, daySpendResult, monthSpendResult, dayCountResult, hourCountResult, minuteCountResult, eventsResult] = await Promise.all([
    admin.from('ai_runtime_controls').select('*').eq('id', 1).maybeSingle(),
    admin.from('ai_spend_windows').select('reserved_microusd').eq('window_start', dayStart).eq('scope_key', 'global:day').maybeSingle(),
    admin.from('ai_spend_windows').select('reserved_microusd').eq('window_start', monthStart).eq('scope_key', 'global:month').maybeSingle(),
    admin.from('ai_request_windows').select('request_count').eq('window_start', dayStart).eq('scope_key', 'global:day').maybeSingle(),
    admin.from('ai_request_windows').select('request_count').eq('window_start', hourStart).eq('scope_key', 'global:hour').maybeSingle(),
    admin.from('ai_request_windows').select('request_count').eq('window_start', minuteStart).eq('scope_key', 'global:minute').maybeSingle(),
    admin.from('ai_usage_events').select('id, request_id, feature, provider, model, status, input_tokens, output_tokens, estimated_cost_microusd, actual_cost_microusd, error_code, created_at').order('created_at', { ascending: false }).limit(50),
  ]);

  const firstError = [controlResult, daySpendResult, monthSpendResult, dayCountResult, hourCountResult, minuteCountResult, eventsResult].find((r) => r.error);
  if (firstError?.error) {
    console.error('AI admin monitor query failed', { code: firstError.error.code || 'unknown' });
    return NextResponse.json({ error: 'AI monitoring schema is not ready. Apply the AI budget migrations first.' }, { status: 503 });
  }
  const controls = controlResult.data;
  if (!controls) return NextResponse.json({ error: 'AI runtime control row is missing. Apply the AI budget migrations.' }, { status: 503 });

  const dailyCap = Number(controls.global_daily_limit_microusd);
  const monthlyCap = Number(controls.global_monthly_limit_microusd);
  const dailySpend = Number(daySpendResult.data?.reserved_microusd ?? 0);
  const monthlySpend = Number(monthSpendResult.data?.reserved_microusd ?? 0);
  if (!(await evaluateAiBudgetAlerts(admin))) {
    return NextResponse.json({ error: 'AI budget alert monitoring unavailable.' }, { status: 503 });
  }
  const { data: alertHistory, error: alertError } = await admin
    .from('ai_budget_alerts')
    .select('*')
    .order('last_seen_at', { ascending: false })
    .limit(30);
  if (alertError) return NextResponse.json({ error: 'AI alert history is unavailable.' }, { status: 503 });
  const activeAlerts = (alertHistory ?? []).filter((alert) => alert.active).map((alert) => ({
    key: alert.alert_key,
    level: alert.level,
    metric: alert.metric,
    observed: usd(alert.observed_microusd),
    threshold: usd(alert.threshold_microusd),
  }));

  return NextResponse.json({
    controls: {
      isPaused: controls.is_paused,
      pauseReason: controls.pause_reason,
      globalDailyLimitUsd: usd(dailyCap),
      globalMonthlyLimitUsd: usd(monthlyCap),
      userDailyLimitUsd: usd(controls.user_daily_limit_microusd),
      userMonthlyLimitUsd: usd(controls.user_monthly_limit_microusd),
      updatedAt: controls.updated_at,
    },
    usage: {
      dailyReservedUsd: usd(dailySpend),
      monthlyReservedUsd: usd(monthlySpend),
      dailyRequestCount: Number(dayCountResult.data?.request_count ?? 0),
      hourlyRequestCount: Number(hourCountResult.data?.request_count ?? 0),
      minuteRequestCount: Number(minuteCountResult.data?.request_count ?? 0),
      dailyPercent: dailyCap ? Math.min(100, dailySpend / dailyCap * 100) : 0,
      monthlyPercent: monthlyCap ? Math.min(100, monthlySpend / monthlyCap * 100) : 0,
    },
    recentEvents: eventsResult.data ?? [],
    alerts: activeAlerts,
    alertHistory: alertHistory ?? [],
    configuration: {
      serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      internalVoiceTokenConfigured: Boolean(process.env.AI_BUDGET_INTERNAL_TOKEN),
      providerCallsApproved: process.env.AI_PROVIDER_CALLS_ENABLED === 'true',
      alertWebhookConfigured: Boolean(process.env.AI_BUDGET_ALERT_WEBHOOK_URL),
    },
    generatedAt: now.toISOString(),
    note: 'Spend is reserved estimated cost, not a provider invoice. Token and actual-cost fields remain empty until provider usage reconciliation is implemented.',
  });
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if ('response' in context) return context.response;
  const { admin, user } = context;
  const length = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > 4096) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 });
  }

  if (body.action === 'pause') {
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : 'Emergency stop activated by admin';
    const { data, error } = await admin.rpc('set_ai_runtime_pause', {
      p_is_paused: true,
      p_pause_reason: reason || 'Emergency stop activated by admin',
      p_updated_by: user.id,
    });
    if (error || data !== true) return NextResponse.json({ error: 'Could not activate emergency stop.' }, { status: 503 });
    return NextResponse.json({ ok: true, isPaused: true });
  }

  if (body.action === 'resume') {
    if (process.env.AI_PROVIDER_CALLS_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Resume is locked. Set AI_PROVIDER_CALLS_ENABLED=true only after review, verified migrations, and provider limits are configured.' }, { status: 409 });
    }
    const { data, error } = await admin.rpc('set_ai_runtime_pause', {
      p_is_paused: false,
      p_pause_reason: '',
      p_updated_by: user.id,
    });
    if (error || data !== true) return NextResponse.json({ error: 'Could not update AI runtime control.' }, { status: 503 });
    return NextResponse.json({ ok: true, isPaused: false });
  }

  if (body.action === 'limits') {
    const values = [body.globalDailyUsd, body.globalMonthlyUsd, body.userDailyUsd, body.userMonthlyUsd];
    if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
      return NextResponse.json({ error: 'All budget limits must be valid numbers.' }, { status: 400 });
    }
    const [globalDailyUsd, globalMonthlyUsd, userDailyUsd, userMonthlyUsd] = values as number[];
    if (
      globalDailyUsd < 0.1 || globalDailyUsd > 25 ||
      globalMonthlyUsd < 1 || globalMonthlyUsd > 500 ||
      userDailyUsd < 0.05 || userDailyUsd > 5 ||
      userMonthlyUsd < 0.25 || userMonthlyUsd > 100 ||
      globalDailyUsd > globalMonthlyUsd ||
      userDailyUsd > globalDailyUsd ||
      userMonthlyUsd > globalMonthlyUsd ||
      userDailyUsd > userMonthlyUsd
    ) return NextResponse.json({ error: 'Limits are outside safe bounds or inconsistent.' }, { status: 400 });

    const { data, error } = await admin.rpc('set_ai_budget_limits', {
      p_global_daily_limit_microusd: Math.round(globalDailyUsd * 1_000_000),
      p_global_monthly_limit_microusd: Math.round(globalMonthlyUsd * 1_000_000),
      p_user_daily_limit_microusd: Math.round(userDailyUsd * 1_000_000),
      p_user_monthly_limit_microusd: Math.round(userMonthlyUsd * 1_000_000),
      p_updated_by: user.id,
    });
    if (error || data !== true) return NextResponse.json({ error: 'Budget limits were rejected by the database safety checks.' }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
