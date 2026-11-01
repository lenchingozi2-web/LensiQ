import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = p => readFile(new URL('../'+p, import.meta.url), 'utf8');

test('Text and explanation routes retain auth and paid access without obsolete AI spend gates', async () => {
  for (const file of ['app/api/teach/route.ts','app/api/explain/route.ts']) {
    const code = await read(file);
    assert.match(code,/GEMINI_API_KEY/);
    assert.doesNotMatch(code,/reserveAiRequest|request-budget|ai_rate_limited/);
  }
  assert.match(await read('app/api/teach/route.ts'),/checkAccess\('teaching'\)/);
  assert.match(await read('app/api/explain/route.ts'),/checkAccess\('explanation'\)/);
});

test('native Gemini routes and SSE client are paired', async () => {
  assert.match(await read('app/api/teach/route.ts'),/streamGenerateContent\?alt=sse/);
  assert.match(await read('app/teach/page.tsx'),/parsed\.candidates/);
  assert.match(await read('app/api/explain/route.ts'),/:generateContent/);
});

test('Admin Refresh fetches uncached status and requires admin authentication', async () => {
  const view = await read('app/admin/ai-usage/AiUsagePanel.tsx');
  const api = await read('app/api/admin/ai-health/route.ts');
  assert.match(view,/aria-busy=\{loading\}/);
  assert.match(view,/cache: 'no-store'/);
  assert.match(view,/Last checked/);
  assert.match(api,/profile\?\.role !== 'admin'/);
  assert.match(api,/private, no-store/);
});

test('voice worker joins before optional lecture loading', async () => {
  const voice = await read('pipecat-voice-agent/agent.py');
  const join = voice.indexOf('await queue_initial_greeting("pipeline_start")');
  const preload = voice.indexOf('await asyncio.wait_for(material_bridge.preload(), timeout=20)');
  assert.ok(join>=0 && preload>join);
  assert.match(voice,/PipelineRunner\(\)\.run\(task\)/);
  assert.doesNotMatch(voice,/AiBudgetGate|budget_gate|AI_BUDGET/);
});
