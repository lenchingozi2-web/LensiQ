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

test('voice model generation is budget-gated and restricted to Gemini or Groq', async () => {
  const voice = await read('pipecat-voice-agent/agent.py');
  assert.match(voice, /class AiBudgetGate/);
  assert.match(voice, /AI_BUDGET_INTERNAL_TOKEN/);
  assert.match(voice, /user_aggregator, material_bridge, budget_gate, llm/);
  assert.match(voice, /GEMINI_API_KEY/);
  assert.match(voice, /GROQ_API_KEY/);
  assert.match(voice, /def _provider_for_endpoint/);
  assert.match(voice, /generativelanguage\.googleapis\.com/);
  assert.match(voice, /api\.groq\.com/);
  assert.match(voice, /GPT\/OpenAI fallback is disabled/);
  assert.doesNotMatch(voice, /gpt-4o-mini|OPENAI_API_KEY|DEEPSEEK_API_KEY|api\.openai\.com/);
});

test('Live Class voice reservations are exempt from dollar caps but retain rate limits and safety pause', async () => {
  const route = await read('app/api/internal/ai-budget/route.ts');
  const migration = await read('supabase/migrations/0048_live_class_uncapped_voice_spend.sql');
  assert.match(route, /body\.feature === 'voice'[\s\S]*?reserve_live_class_ai_request/);
  assert.match(migration, /user_minute_limit/);
  assert.match(migration, /global_day_count >= 5000/);
  assert.match(migration, /ai_spend_reservations/);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.ai_spend_windows/i);
  assert.match(route, /controls\.is_paused/);
});

test('Live Class is paid-tier gated and has a server-enforced 90-minute graceful close', async () => {
  const plans = await read('lib/plans.ts');
  const reservation = await read('supabase/migrations/0047_live_class_90_minute_cap.sql');
  const token = await read('app/api/voice/token/route.ts');
  const session = await read('app/voice/page.tsx');
  const worker = await read('pipecat-voice-agent/agent.py');
  const modal = await read('pipecat-voice-agent/agent_modal.py');
  assert.match(plans, /function includesLiveClass[\s\S]*?premium_monthly/);
  assert.doesNotMatch(plans.slice(plans.indexOf('function includesLiveClass')), /premium_text_monthly/);
  assert.match(reservation, /least\(5400/);
  assert.match(reservation, /session_time_limit/);
  assert.match(token, /Math\.min\(90 \* 60/);
  assert.match(worker, /close_at_session_deadline/);
  assert.match(worker, /EndFrame\(\)/);
  assert.match(worker, /def build_wrapup/);
  assert.match(worker, /self\.source_labels/);
  assert.match(session, /Math\.ceil\(\(sessionDeadlineAtRef\.current! - Date\.now\(\)\) \/ 1000\)/);
  assert.match(session, /35_000/);
  assert.match(modal, /timeout=95 \* 60/);
});

test('Live Class leaves Thinking on assistant text and surfaces bounded greeting/answer timeouts', async () => {
  const client = await read('app/voice/page.tsx');
  assert.match(client, /runtimeStateRef\.current = 'TEACHING';\s*setRuntimeState\('TEACHING'\)/);
  assert.match(client, /not replied yet[\s\S]{0,260}30000/);
  assert.match(client, /not joined the audio room yet[\s\S]{0,260}25000/);
  assert.match(client, /runtimeStateRef\.current === 'INITIALIZING' \|\| runtimeStateRef\.current === 'READY'/);
});

test('voice budget context bounding uses the supported Pipecat setter and normal discussion pacing', async () => {
  const voice = await read('pipecat-voice-agent/agent.py');
  assert.match(voice, /set_messages\(bounded\)/);
  assert.doesNotMatch(voice, /context\.messages\s*=\s*bounded/);
  assert.match(voice, /speed=1\.08/);
  assert.match(voice, /WHISPER_MODEL", "tiny\.en"/);
  assert.match(voice, /normal, lively conversational pace/);
  assert.match(voice, /transcription received \(characters=%d\)/);
  assert.match(voice, /budget reservation authorized/);
  assert.match(voice, /tutor response text generated \(characters=%d\)/);
});

test('Google OAuth does not force account selection or consent for returning Google sessions', async () => {
  const route = await read('app/auth/google/route.ts');
  assert.match(route, /provider: 'google'/);
  assert.match(route, /redirectTo: `\$\{origin\}\/auth\/callback/);
  assert.doesNotMatch(route, /prompt:\s*['"]select_account['"]/);
});

test('server Supabase client uses the supported cookie adapter to preserve OAuth sessions', async () => {
  const serverClient = await read('lib/supabase/server.ts');
  assert.match(serverClient, /getAll\(\)\s*\{\s*return cookieStore\.getAll\(\)/);
  assert.match(serverClient, /setAll\(cookiesToSet\)/);
  assert.match(serverClient, /cookieStore\.set\(\{ name, value, \.\.\.options \}\)/);
  assert.doesNotMatch(serverClient, /get\(name: string\)|remove\(name: string/);
});

test('auth rejection diagnostics log cookie-presence booleans without token values', async () => {
  const diagnostics = await read('lib/auth/request-diagnostics.ts');
  assert.match(diagnostics, /hasSupabaseSessionCookie/);
  assert.match(diagnostics, /hasPkceCookie/);
  assert.match(diagnostics, /hasActiveSessionCookie/);
  assert.match(diagnostics, /authErrorCode/);
  assert.doesNotMatch(diagnostics, /console\.error\([^\n]*rawCookieHeader/);
  assert.doesNotMatch(diagnostics, /access_token|refresh_token|user\.id/);
});

test('Modal room workers receive the dedicated shared budget-token secret', async () => {
  const modalConfig = await read('pipecat-voice-agent/agent_modal.py');
  assert.match(modalConfig, /ai_budget_secret\s*=\s*modal\.Secret\.from_name\(['"]ai-budget-secret['"]\)/);
  assert.match(modalConfig, /secrets=\[livekit_credentials, llm_fallback, ai_budget_secret\]/);
});

test('room-poll Live Class stores learner identity in room metadata before polling', async () => {
  const tokenRoute = await read('app/api/voice/token/route.ts');
  const modalConfig = await read('pipecat-voice-agent/agent_modal.py');
  assert.match(tokenRoute, /LIVEKIT_DISPATCH_MODE === 'room-poll'[\s\S]*?createRoom\(\{ name: roomName, metadata: dispatchMetadata \}\)/);
  assert.match(tokenRoute, /livekit_room_setup_failed/);
  assert.match(modalConfig, /if not any\(not p\.identity\.startswith\(AGENT_NAME\) for p in participants\.participants\):\s*continue/);
});

test('voice budget denials distinguish missing session context from actual allowance limits', async () => {
  const voice = await read('pipecat-voice-agent/agent.py');
  assert.match(voice, /missing required settings: %s/);
  assert.match(voice, /AI usage allowance has been reached/);
  assert.doesNotMatch(voice, /at capacity/);
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

test('forward migration fixes ambiguous reserved_microusd output-variable references', async () => {
  const migration = await read('supabase/migrations/0045_fix_ai_budget_ambiguous_column.sql');
  assert.match(migration, /create or replace function public\.reserve_ai_budget/i);
  assert.equal((migration.match(/coalesce\(w\.reserved_microusd, 0\)/g) || []).length, 4);
  assert.doesNotMatch(migration, /select coalesce\(reserved_microusd, 0\)/i);
  assert.match(migration, /grant execute on function public\.reserve_ai_budget\(uuid, text, uuid\) to service_role/i);
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


test('usage alerts are evaluated before guarded requests can proceed', async () => {
  const budget = await read('lib/ai/request-budget.ts');
  const voice = await read('app/api/internal/ai-budget/route.ts');
  const alerts = await read('lib/ai/budget-alerts.ts');
  assert.match(budget, /evaluateAiBudgetAlerts\(admin\)/);
  assert.match(voice, /evaluateAiBudgetAlerts\(admin\)/);
  assert.match(alerts, /\[50, 'warning'\]/);
  assert.match(alerts, /\[80, 'critical'\]/);
  assert.match(alerts, /AI_BUDGET_ALERT_WEBHOOK_URL/);
  assert.match(alerts, /AbortSignal\.timeout\(3000\)/);
});

test('admin writes use serialized service-role RPCs rather than direct table updates', async () => {
  const route = await read('app/api/admin/ai-control/route.ts');
  const migration = await read('supabase/migrations/0044_ai_usage_monitoring.sql');
  assert.match(route, /rpc\('set_ai_runtime_pause'/);
  assert.match(route, /rpc\('set_ai_budget_limits'/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('ai-budget-control-global', 0\)\)/);
  assert.match(migration, /revoke all on function public\.set_ai_runtime_pause/i);
  assert.match(migration, /revoke all on function public\.set_ai_budget_limits/i);
});


test('monitoring migration also upgrades previously-created reservation RPC', async () => {
  const migration = await read('supabase/migrations/0044_ai_usage_monitoring.sql');
  assert.match(migration, /create or replace function public\.reserve_ai_budget/i);
  assert.match(migration, /from public\.ai_runtime_controls where id = 1/i);
  assert.match(migration, /v_global_day_spend \+ v_cost > v_global_daily_cap/);
  assert.match(migration, /ai_globally_paused/);
  assert.match(migration, /grant execute on function public\.reserve_ai_budget\(uuid, text, uuid\) to service_role/i);
});
