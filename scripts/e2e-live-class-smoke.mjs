#!/usr/bin/env node
/**
 * Destructive, opt-in HTTP + database E2E for a DEDICATED, disposable, active,
 * subscribed Live Class session. It must never operate on a learner's real class.
 * Requires Node 24+, npm ci, a deployed build of this branch, and secrets below.
 *
 * E2E_BASE_URL                 https://deployed-branch.example
 * E2E_AUTH_COOKIE              Cookie header of the dedicated test account
 * E2E_USER_ID                  Dedicated auth.users.id
 * E2E_SESSION_ID               Dedicated active live_class_sessions.id
 * E2E_CONFIRM_DEDICATED_SESSION=true
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LIVEKIT_API_SECRET
 *
 * This verifies actual HTTP, Storage, Postgres, SQL retrieval and protocol
 * transitions, NOT physical microphone, audio playout or browser render timing.
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';
import { LookaheadBuffer } from '../lib/live-class/lookahead-buffer.ts';
import { VisualStateStack, parseVisualCue } from '../lib/live-class/visual-protocol.ts';
import { issueLiveClassGatewayToken } from '../lib/voice/live-class-gateway-auth.ts';
import { purgeSessionMaterialsOnEnd } from '../lib/rag/ephemeral-cleanup.ts';

const E = process.env;
const BUCKET = 'study-documents';
const EXPECTED = E.CUTOVER_EXPECTED_PROJECT_REF || 'hixvbcrrklyajhkyliay';
const report = { scope: 'real Supabase + deployed HTTP, protocol-level visual checks (not RTC/audio)',
  latency_ms: {}, checks: {}, total_source_lines: 0, preserved_source_lines: 0,
  remaining_files: null, remaining_bytes: null, remaining_chunks: null, pass: false };
const mark = (key, ok, detail) => {
  report.checks[key] = { ok, detail };
  console.log((ok ? 'PASS ' : 'FAIL ') + key + ': ' + detail);
};
const req = (key) => {
  if (!E[key]) throw new Error('Missing required ' + key);
  return E[key];
};
const tick = () => performance.now();
const elapsed = (start) => Math.round((performance.now() - start) * 100) / 100;
const fixtures = [
  { name: 'e2e-heart-anatomy.txt', text:
    '# Heart anatomy\n[Page 1]\n' +
    'The right atrium receives systemic venous blood from the venae cavae.\n' +
    'The left ventricle pumps oxygenated blood into the aorta.\n' +
    'Competitive antagonism shifts the dose-response curve to the right.\n' +
    '| Agent | Dose | Mechanism |\n| Prototype A | 2.5 mg | Reversible binding |\n' },
  { name: 'e2e-heart-overlap.txt', text:
    '# Heart anatomy\n[Page 2]\n' +
    'Competitive antagonism shifts the dose-response curve to the right.\n' +
    'Aortic-valve closure corresponds to the second heart sound.\n' +
    '| Agent | Dose | Mechanism |\n| Prototype B | 5 mg | Receptor occupancy |\n' },
  { name: 'e2e-antagonism.txt', text:
    '# Competitive antagonism\n[Page 3]\n' +
    'Competitive antagonism shifts the dose-response curve to the right.\n' +
    'Surmountable antagonism typically preserves the maximal response.\n' +
    'A higher agonist concentration is required for equivalent occupancy.\n' +
    '| Agonist | EC50 | Emax |\n| Example | 10 nmol/L | Unchanged |\n' },
];
const factLines = (text) => text.split(/\r?\n/).map(x => x.trim())
  .filter(x => x && !x.startsWith('#') && !/^\[(?:Page|Slide)\s+\d+\]$/i.test(x));
let admin;
let syllabusId;
let sessionId;
let userId;
let cookie;
let base;
let created = false;
let cleaned = false;
let accessToken;
const api = async (endpoint, body, authType = 'cookie') => {
  const headers = { 'content-type': 'application/json' };
  if (authType === 'gateway') headers.authorization = 'Bearer ' + accessToken;
  else headers.cookie = cookie;
  if (E.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = E.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  const start = tick();
  const res = await fetch(new URL(endpoint, base), {
    method: 'POST', headers, body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000),
  });
  return { res, ms: elapsed(start) };
};
const jsonApi = async (endpoint, body, authType) => {
  const { res, ms } = await api(endpoint, body, authType);
  const text = await res.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error(endpoint + ' non-JSON HTTP ' + res.status); }
  if (!res.ok || result.error) throw new Error(endpoint + ' HTTP ' + res.status +
    ': ' + (result.error || 'request rejected'));
  return { result, ms };
};
const must = (error, step) => { if (error) throw new Error(step + ': ' + error.message); };

async function verifyWipe() {
  const prefix = userId + '/' + syllabusId;
  const { data: files, error: fileError } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  must(fileError, 'List final Storage objects');
  report.remaining_files = files?.length ?? 0;
  report.remaining_bytes = (files || []).reduce((sum, file) => sum + Number(file.metadata?.size || 0), 0);
  const { count, error: chunkError } = await admin.from('document_atomic_chunks')
    .select('id', { head: true, count: 'exact' }).eq('syllabus_id', syllabusId);
  must(chunkError, 'Count final RAG vectors');
  report.remaining_chunks = count;
  const { count: docCount, error: docError } = await admin.from('study_documents')
    .select('id', { head: true, count: 'exact' }).eq('syllabus_id', syllabusId);
  must(docError, 'Count final document references');
  const { count: nodeCount, error: nodeError } = await admin.from('syllabus_concept_nodes')
    .select('id', { head: true, count: 'exact' }).eq('syllabus_id', syllabusId);
  must(nodeError, 'Count final compiled notes');
  const { data: syllabus, error: syllabusError } = await admin.from('study_syllabi')
    .select('status,used_bytes,reserved_bytes').eq('id', syllabusId).single();
  must(syllabusError, 'Verify final syllabus status');
  const ok = report.remaining_files === 0 && report.remaining_bytes === 0 &&
    report.remaining_chunks === 0 && docCount === 0 && nodeCount === 0 &&
    syllabus?.status === 'purged' && Number(syllabus.used_bytes) === 0 &&
    Number(syllabus.reserved_bytes) === 0;
  mark('zero_active_storage_and_database_residue', ok,
    'files=' + report.remaining_files + ', bytes=' + report.remaining_bytes +
    ', chunks=' + report.remaining_chunks + ', docs=' + docCount +
    ', notes=' + nodeCount + ', status=' + syllabus?.status);
  return ok;
}

try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node 24+ required');
  if (req('E2E_CONFIRM_DEDICATED_SESSION') !== 'true') {
    throw new Error('Explicit dedicated-session approval required; never smoke-test a real student class');
  }
  const url = new URL(req('NEXT_PUBLIC_SUPABASE_URL'));
  if (url.protocol !== 'https:' || url.hostname !== EXPECTED + '.supabase.co') {
    throw new Error('Wrong Supabase project. Expected ' + EXPECTED + '.supabase.co');
  }
  base = new URL(req('E2E_BASE_URL'));
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && base.hostname === 'localhost')) {
    throw new Error('E2E_BASE_URL must be HTTPS (localhost may use HTTP)');
  }
  const key = req('SUPABASE_SERVICE_ROLE_KEY');
  const workerSecret = req('LIVEKIT_API_SECRET');
  cookie = req('E2E_AUTH_COOKIE');
  userId = req('E2E_USER_ID');
  sessionId = req('E2E_SESSION_ID');
  assert.match(userId, /^[0-9a-f-]{36}$/i);
  assert.match(sessionId, /^[0-9a-f-]{36}$/i);
  admin = createClient(url.origin, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: session, error: sessionError } = await admin.from('live_class_sessions')
    .select('id,user_id,status,room_name').eq('id', sessionId).eq('user_id', userId).single();
  must(sessionError, 'Check disposable Live Class');
  assert.equal(session.status, 'active', 'Dedicated session must be active');
  assert.match(session.room_name, /^lensiq-voice-[a-z0-9-]{12,100}$/);
  const { count: oldSyllabi, error: oldError } = await admin.from('study_syllabi')
    .select('id', { head: true, count: 'exact' }).eq('session_id', sessionId);
  must(oldError, 'Check session is unused');
  assert.equal(oldSyllabi, 0, 'Refuse to run in any session with existing learning materials');
  const { data: oldLesson, error: oldLessonError } = await admin.from('live_class_lessons')
    .select('session_id').eq('session_id', sessionId).maybeSingle();
  must(oldLessonError, 'Check session is not already teaching');
  assert.equal(oldLesson, null, 'Refuse to mutate an in-progress lesson');
  mark('dedicated_class_ownership', true, 'Active, owned and unused session verified');

  // Real API authorizes the learner and reserves 3 files before any upload.
  const files = fixtures.map(f => ({ name: f.name, size: Buffer.byteLength(f.text), type: 'text/plain' }));
  const uploadStart = tick();
  const prepared = (await jsonApi('/api/rag/ingest-batch',
    { action: 'prepare', sessionId, files })).result;
  syllabusId = prepared.syllabusId;
  created = true;
  assert.match(syllabusId, /^[0-9a-f-]{36}$/i);
  assert.equal(prepared.uploads?.length, fixtures.length);
  const fileBytes = new Map(fixtures.map(f => [f.name, Buffer.byteLength(f.text)]));
  for (const reservation of prepared.uploads) {
    const source = fixtures.find(f => f.name === reservation.fileName);
    assert.ok(source, 'All reservations must correspond to approved test fixtures');
    const { error: uploadError } = await admin.storage.from(BUCKET)
      .uploadToSignedUrl(reservation.path, reservation.token,
        Buffer.from(source.text), { contentType: 'text/plain', upsert: false });
    must(uploadError, 'Upload ' + reservation.fileName);
    await jsonApi('/api/rag/ingest-batch',
      { action: 'confirm', documentId: reservation.documentId });
  }
  report.latency_ms.upload_confirm = elapsed(uploadStart);
  mark('signed_upload_confirm', true,
    fixtures.length + ' files; ' + [...fileBytes.values()].reduce((a,b)=>a+b,0) +
    ' bytes; ' + report.latency_ms.upload_confirm + 'ms');

  const compileStart = tick();
  const compile = await api('/api/rag/compile-syllabus', { syllabusId });
  const compiledText = await compile.res.text();
  report.latency_ms.compile = elapsed(compileStart);
  assert.equal(compile.res.status, 200, 'Compilation endpoint HTTP status');
  if (compiledText.includes('event: error') || !compiledText.includes('event: complete')) {
    throw new Error('SSE compilation failed or did not complete; ' + compiledText.slice(-400));
  }
  const { data: chunks, error: chunkError } = await admin.from('document_atomic_chunks')
    .select('source_file,page_number,chunk_text,document_id').eq('syllabus_id', syllabusId).limit(1000);
  must(chunkError, 'Read indexed chunks');
  assert.ok(chunks?.length, 'Compilation should have indexed source chunks');
  const missing = [];
  for (const fixture of fixtures) {
    for (const line of factLines(fixture.text)) {
      report.total_source_lines++;
      const located = chunks.some(c => c.source_file === fixture.name &&
        c.chunk_text.includes(line));
      if (located) report.preserved_source_lines++;
      else missing.push(fixture.name + ': ' + line.slice(0,100));
    }
  }
  const factOk = missing.length === 0;
  mark('fact_and_source_provenance_preservation', factOk,
    report.preserved_source_lines + '/' + report.total_source_lines +
    ' original non-heading lines, including overlapping exact statements; ' +
    (missing.length ? 'missing ' + JSON.stringify(missing) : 'no dropped fixture lines'));
  assert.ok(factOk, 'Source details or original-file citations were lost');
  const { data: concepts, error: conceptError } = await admin.from('syllabus_concept_nodes')
    .select('id,title,visual_spec_json').eq('syllabus_id', syllabusId)
    .eq('node_type', 'concept').order('sort_order', { ascending: true });
  must(conceptError, 'Read compiled concept tree');
  assert.ok(concepts?.length >= 2);
  mark('syllabus_compilation', true,
    concepts.length + ' concepts; ' + chunks.length + ' source chunks; ' +
    report.latency_ms.compile + 'ms');

  // Real orchestrator HTTP startup and a real Supabase-backed lookahead load.
  const boot = (await jsonApi('/api/live-class/orchestrate',
    { action: 'bootstrap', sessionId, syllabusId })).result;
  const started = await jsonApi('/api/live-class/orchestrate',
    { action: 'start', sessionId, stateVersion: boot.state.state_version });
  report.latency_ms.teaching_packet_http = started.ms;
  const packet = started.result.packet;
  assert.ok(packet?.visual_cues?.length >= 3, 'Teaching packet must advance through 3 stages');
  assert.deepEqual(packet.visual_cues.slice(0,3).map(c => c.mode),
    ['whiteboard', 'anatomy_3d', 'whiteboard']);
  assert.ok(packet.visual_cues.every(c => c.citations?.length),
    'Teaching cues must carry verified citations');
  mark('real_3d_visual_progression', true,
    packet.visual_cues.map(c=>c.mode).join(' -> '));

  const nextId = started.result.lookahead?.conceptNodeId;
  assert.ok(nextId, 'At least one next concept is needed to benchmark lookahead');
  const buffer = new LookaheadBuffer(async id => {
    const { data, error } = await admin.from('syllabus_concept_nodes')
      .select('id,title').eq('syllabus_id', syllabusId).eq('id', id).single();
    must(error, 'Lookahead fetch');
    return data;
  });
  await buffer.warm(nextId);
  const hitStart = tick();
  const warmed = await buffer.get(nextId);
  report.latency_ms.lookahead_cache_hit = elapsed(hitStart);
  assert.equal(warmed.id, nextId);
  const hitOk = report.latency_ms.lookahead_cache_hit < 50;
  mark('lookahead_warm_cache_under_50ms', hitOk,
    report.latency_ms.lookahead_cache_hit + 'ms (warm memory cache, excludes first DB query)');
  assert.ok(hitOk, 'Warm lookahead exceeded 50ms');

  // Simulated worker protocol with REAL signed gateway requests and DB state.
  accessToken = issueLiveClassGatewayToken(workerSecret, {
    roomName: session.room_name, sessionId, userId,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  const active = packet.visual_cues[1];
  const snapshot = {
    active_mode: active.mode, concept_node_id: packet.concept_node_id,
    cue_index: 1, whiteboard_snapshot: [...packet.visual_cues[0].steps],
    active_cue: active,
  };
  const interrupted = (await jsonApi('/api/live-class/orchestrate',
    { action: 'barge_in', sessionId,
      stateVersion: started.result.state.state_version, visualSnapshot: snapshot })).result;
  assert.equal(interrupted.state.phase, 'HANDLING_INTERRUPT');
  const { data: interruptedRow, error: rowError } = await admin.from('live_class_lessons')
    .select('visual_stack_json').eq('session_id', sessionId).single();
  must(rowError, 'Read paused class checkpoint');
  assert.deepEqual(interruptedRow.visual_stack_json?.[0], snapshot,
    'Durable visual stack must preserve the exact paused checkpoint');

  const question = 'competitive antagonism';
  const interruptedStart = tick();
  const evidence = (await jsonApi('/api/live-class/interrupt-rag',
    { sessionId, query: question }, 'gateway')).result;
  report.latency_ms.interrupt_rag_http = elapsed(interruptedStart);
  const citations = evidence.matches?.map(x => x.citation) || [];
  const filesCited = new Set(citations.map(x => x.file_name));
  assert.ok(filesCited.size >= 2, 'Retrieval must connect at least two separate handouts');
  const scratchpad = parseVisualCue({
    id: 'interrupt-scratchpad', mode: 'whiteboard_scratchpad',
    title: 'Cross-document question', spoken_text: question,
    steps: evidence.matches.map(x=>x.text.slice(0,300)), citations,
  });
  const stateStack = new VisualStateStack();
  stateStack.push(snapshot);
  assert.equal(scratchpad.mode, 'whiteboard_scratchpad');
  assert.deepEqual(scratchpad.citations, citations.slice(0,50));
  const resumed = (await jsonApi('/api/live-class/orchestrate',
    { action: 'interrupt_done', sessionId,
      stateVersion: interrupted.state.state_version }, 'gateway')).result;
  assert.deepEqual(resumed.restoredVisual, snapshot);
  assert.deepEqual(stateStack.pop(), snapshot);
  assert.equal(resumed.state.phase, 'TEACHING_NODE');
  mark('interrupt_cited_scratchpad_checkpoint_restore', true,
    citations.length + ' citations from ' + filesCited.size +
    ' source files; RAG HTTP ' + report.latency_ms.interrupt_rag_http + 'ms');

  const endStart = tick();
  const ended = (await jsonApi('/api/live-class/orchestrate',
    { action: 'end', sessionId, stateVersion: resumed.state.state_version })).result;
  assert.equal(ended.state.phase, 'COMPLETED');
  assert.ok(Array.isArray(ended.purge), 'Server-side class end must call persistent purge');
  await jsonApi('/api/voice/session', { action: 'end', sessionId, durationSeconds: 0 });
  // Calling the shared purge routine again must be safe and leave nothing behind.
  const retry = await purgeSessionMaterialsOnEnd(admin, userId, sessionId);
  assert.equal(retry.length, 0, 'Purge must be idempotent after class end');
  report.latency_ms.end_and_purge = elapsed(endStart);
  cleaned = await verifyWipe();
  mark('idempotent_end_and_purge', cleaned,
    'end + cleanup ' + report.latency_ms.end_and_purge + 'ms');
} catch (error) {
  mark('e2e_execution', false, error.stack || error.message);
} finally {
  if (created && !cleaned && admin && syllabusId && sessionId && userId) {
    console.error('RECOVERY: attempting owner-scoped purge of failed disposable fixture session');
    try {
      const cleanup = await purgeSessionMaterialsOnEnd(admin, userId, sessionId);
      const ok = await verifyWipe();
      mark('failure_recovery_purge', ok,
        'purged ' + cleanup.length + ' fixture syllabi');
    } catch (error) {
      mark('failure_recovery_purge', false, error.message);
      console.error('CRITICAL: do not merge; manually inspect residual fixture data for syllabus ' + syllabusId);
    }
  }
}
report.pass = Object.values(report.checks).every(x=>x.ok);
console.log('\nLIVE_CLASS_E2E_REPORT ' + JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
