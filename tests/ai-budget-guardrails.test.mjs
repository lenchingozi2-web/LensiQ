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
  assert.match(sql, /25000000/);
  assert.match(sql, /500000000/);
  assert.match(sql, /5000000/);
  assert.match(sql, /100000000/);
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
