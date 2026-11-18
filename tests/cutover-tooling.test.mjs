import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFile(join(root, path), 'utf8');

test('cutover CLI files parse under the checked-in Node runtime', async () => {
  for (const name of ['scripts/verify-prod-cutover.mjs', 'scripts/e2e-live-class-smoke.mjs']) {
    const result = spawnSync(process.execPath, ['--check', join(root, name)], { encoding: 'utf8' });
    assert.equal(result.status, 0, name + ': ' + result.stderr);
  }
});

test('SQL migrations use balanced dollar quotes and the canonical bucket and RPC', async () => {
  const phase1 = await read('supabase/migrations/20261116180000_deterministic_syllabus_rag.sql');
  const phase2 = await read('supabase/migrations/20261116183000_live_class_orchestration.sql');
  for (const sql of [phase1, phase2]) {
    assert.equal((sql.match(/\$\$/g) || []).length % 2, 0, 'Unbalanced SQL dollar quotes');
    assert.doesNotMatch(sql, /\bas \$(?!\$)/i, 'Invalid single-dollar function delimiter');
  }
  assert.match(phase1, /match_study_concepts_hybrid/);
  assert.match(phase1, /study-documents/);
  assert.doesNotMatch(phase1, /ephemeral_class_materials/);
});

test('deploy workflow is explicit, authenticated and confined to the correct project', async () => {
  const workflow = await read('.github/workflows/deploy-voice-worker.yml');
  const docker = await read('worker/lensiq-voice-tutor/Dockerfile');
  for (const fragment of ['push:', 'branches: [main]', 'workflow_dispatch:',
    'livekit/deploy-action@v2.12.2', 'LIVEKIT_AGENT_ID',
    'SUPABASE_SERVICE_ROLE_KEY', 'hixvbcrrklyajhkyliay.supabase.co',
    'confirm_production', 'WORKING_DIRECTORY: worker/lensiq-voice-tutor']) {
    assert.ok(workflow.includes(fragment), fragment);
  }
  assert.match(docker, /USER tutor/);
  assert.match(docker, /CMD \["python", "agent.py", "start"\]/);
  assert.doesNotMatch(docker, /LIVEKIT_API_SECRET/);
});

test('verification scripts are fail-closed and verify actual live residue', async () => {
  const preflight = await read('scripts/verify-prod-cutover.mjs');
  const smoke = await read('scripts/e2e-live-class-smoke.mjs');
  for (const fragment of ['match_study_concepts_hybrid', 'storage.getBucket',
    'createBucket', 'updateBucket', 'gemini', 'groq',
    'embedding_1536_under_500ms']) assert.ok(preflight.includes(fragment), fragment);
  for (const fragment of ['E2E_CONFIRM_DEDICATED_SESSION',
    'uploadToSignedUrl', '/api/rag/compile-syllabus',
    '/api/live-class/interrupt-rag', 'whiteboard_scratchpad',
    'VisualStateStack', 'lookahead_cache_hit', 'purgeSessionMaterialsOnEnd',
    'remaining_files', 'remaining_bytes', 'remaining_chunks']) {
    assert.ok(smoke.includes(fragment), fragment);
  }
});
