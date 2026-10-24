import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('paid web AI endpoints remain emergency-paused', async () => {
  for (const path of ['app/api/teach/route.ts', 'app/api/explain/route.ts']) {
    const source = await read(path);
    const pause = source.indexOf("status: 503");
    const provider = source.indexOf("https://api.deepseek.com/chat/completions");
    assert.notEqual(pause, -1, `${path} must retain the emergency pause`);
    assert.notEqual(provider, -1, `${path} must keep provider integration for a later reviewed restore`);
    assert.ok(pause < provider, `${path} pause must precede provider call`);
  }
});

test('server budget helper fails closed and calls privileged atomic RPC', async () => {
  const source = await read('lib/ai/request-budget.ts');
  assert.match(source, /createAdminClient\(\)/);
  assert.match(source, /rpc\('reserve_ai_budget'/);
  assert.match(source, /reason: 'budget_unavailable'/);
  assert.match(source, /randomUUID\(\)/);
});

test('database reservation enforces dollar caps, concurrency and service-role access', async () => {
  const sql = await read('supabase/migrations/0043_ai_spend_budget.sql');
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = pg_catalog, public/i);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /v_global_daily_cap bigint := 1000000/);
  assert.match(sql, /v_global_monthly_cap bigint := 10000000/);
  assert.match(sql, /v_user_daily_cap bigint := 250000/);
  assert.match(sql, /v_user_monthly_cap bigint := 2000000/);
  assert.match(sql, /request_id uuid primary key/i);
  assert.match(sql, /revoke all on function public\.reserve_ai_budget\(uuid, text, uuid\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.reserve_ai_budget\(uuid, text, uuid\) to service_role/i);
  assert.match(sql, /duplicate_request/);
  assert.match(sql, /'voice'/);
});

test('request payloads are byte-bounded before paid provider calls', async () => {
  const teach = await read('app/api/teach/route.ts');
  const explain = await read('app/api/explain/route.ts');
  assert.match(teach, /Buffer\.byteLength\(rawBody, 'utf8'\) > 128 \* 1024/);
  assert.match(teach, /reduce\(\(total, message\) => total \+ message\.content\.length, 0\) > 30000/);
  assert.match(explain, /Buffer\.byteLength\(rawBody, 'utf8'\) > 32 \* 1024/);
  assert.match(explain, /questionText\.length > 6000/);
});

test('voice model generation is gated by the shared budget and DeepSeek remains the default', async () => {
  const voice = await read('pipecat-voice-agent/agent.py');
  assert.match(voice, /class AiBudgetGate/);
  assert.match(voice, /AI_BUDGET_INTERNAL_TOKEN/);
  assert.match(voice, /user_aggregator, budget_gate, llm/);
  assert.match(voice, /elif deepseek_api_key:/);
  assert.match(voice, /https:\/\/api\.deepseek\.com\/v1/);
});

test('internal budget endpoint requires a constant-time shared-token check', async () => {
  const route = await read('app/api/internal/ai-budget/route.ts');
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /AI_BUDGET_INTERNAL_TOKEN/);
  assert.match(route, /createAdminClient\(\)/);
  assert.match(route, /reserve_ai_budget/);
});


test('central AI switch defaults paused and stores configurable conservative caps', async () => {
  const migration = await read('supabase/migrations/0044_ai_usage_monitoring.sql');
  assert.match(migration, /is_paused boolean not null default true/i);
  assert.match(migration, /global_daily_limit_microusd bigint not null default 1000000/i);
  assert.match(migration, /global_monthly_limit_microusd bigint not null default 10000000/i);
  assert.match(migration, /user_daily_limit_microusd bigint not null default 250000/i);
  assert.match(migration, /user_monthly_limit_microusd bigint not null default 2000000/i);
  assert.match(migration, /ai_usage_events/);
  assert.match(migration, /ai_budget_alerts/);
  assert.match(migration, /revoke all on public\.ai_runtime_controls from public, anon, authenticated/i);
});

test('budget reservation checks the central pause and configurable caps atomically', async () => {
  const sql = await read('supabase/migrations/0043_ai_spend_budget.sql');
  assert.match(sql, /from public\.ai_runtime_controls where id = 1/i);
  assert.match(sql, /ai_globally_paused/);
  assert.match(sql, /v_global_day_spend \+ v_cost > v_global_daily_cap/);
  assert.match(sql, /v_global_month_spend \+ v_cost > v_global_monthly_cap/);
  assert.match(sql, /v_user_day_spend \+ v_cost > v_user_daily_cap/);
  assert.match(sql, /v_user_month_spend \+ v_cost > v_user_monthly_cap/);
});

test('voice reservation endpoint checks global pause and explicit provider approval', async () => {
  const route = await read('app/api/internal/ai-budget/route.ts');
  assert.match(route, /from\('ai_runtime_controls'\)/);
  assert.match(route, /controls\.is_paused/);
  assert.match(route, /AI_PROVIDER_CALLS_ENABLED !== 'true'/);
  assert.match(route, /ai_usage_events/);
  assert.match(route, /usage logging unavailable; failing closed/i);
});

test('admin AI control API requires an authenticated admin and locks resume behind explicit approval', async () => {
  const route = await read('app/api/admin/ai-control/route.ts');
  assert.match(route, /profile\?\.role !== 'admin'/);
  assert.match(route, /AI_PROVIDER_CALLS_ENABLED !== 'true'/);
  assert.match(route, /action === 'pause'/);
  assert.match(route, /action === 'limits'/);
  assert.match(route, /AI_BUDGET_ALERT_WEBHOOK_URL/);
  assert.match(route, /ai_budget_alerts/);
});
