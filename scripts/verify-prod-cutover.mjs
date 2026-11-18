#!/usr/bin/env node
/**
 * Idempotent production preflight. Read-only except for creating or tightening
 * the explicitly named private Storage bucket after schema/project checks pass.
 * Exit nonzero if any credential, schema, provider, or 500-ms embedding gate fails.
 * Requires Node 24+ and npm ci in the repository root.
 */
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';
import { embedStudyText } from '../lib/rag/embeddings.ts';

const E = process.env;
const TARGET = E.CUTOVER_EXPECTED_PROJECT_REF || 'hixvbcrrklyajhkyliay';
const BUCKET = 'study-documents';
const MAX_BYTES = 70 * 1024 * 1024;
const MIME = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];
const report = { target: TARGET, checks: {}, latency_ms: {}, pass: false };
const mark = (name, ok, detail) => {
  report.checks[name] = { ok, detail };
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ': ' + detail);
};
function requireEnv(key) {
  if (!E[key]) throw new Error('Missing required environment variable ' + key);
  return E[key];
}
function checkTarget(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== TARGET + '.supabase.co') {
    throw new Error('Wrong Supabase project; expected ' + TARGET + '.supabase.co. Refusing all mutations.');
  }
}
async function timeTTFT(label, endpoint, headers, payload, getToken) {
  const start = performance.now();
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(label + ' responded HTTP ' + response.status);
  if (!response.body) throw new Error(label + ' returned no streaming body');
  let pending = '';
  for await (const bytes of response.body) {
    pending += new TextDecoder().decode(bytes).replace(/\r\n/g, '\n');
    while (pending.includes('\n\n')) {
      const index = pending.indexOf('\n\n');
      const item = pending.slice(0, index); pending = pending.slice(index + 2);
      for (const row of item.split('\n')) {
        if (!row.startsWith('data:')) continue;
        const data = row.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let frame;
        try { frame = JSON.parse(data); } catch { continue; }
        if (getToken(frame)) {
          const ms = Math.round((performance.now() - start) * 100) / 100;
          report.latency_ms[label + '_ttft'] = ms;
          return ms;
        }
      }
    }
  }
  throw new Error(label + ' streamed no content token');
}

try {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node 24+ is required');
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  checkTarget(url);
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const tables = ['study_syllabi', 'study_documents', 'syllabus_concept_nodes', 'document_atomic_chunks'];
  let schemaReady = true;
  for (const table of tables) {
    const { error } = await admin.from(table).select('id', { head: true, count: 'exact' }).limit(0);
    const ok = !error;
    mark('table_' + table, ok, ok ? 'accessible' : error.message);
    schemaReady &&= ok;
  }
  const { error: rpcError } = await admin.rpc('match_study_concepts_hybrid', {
    p_syllabus_id: '00000000-0000-4000-8000-000000000001',
    p_query: 'smoke test', p_embedding: null, p_limit: 1,
  });
  mark('rpc_match_study_concepts_hybrid', !rpcError,
    rpcError ? rpcError.message : 'callable (no user data read)');
  schemaReady &&= !rpcError;
  if (!schemaReady) throw new Error('Schema is not ready; apply BOTH tracked migrations before checking Storage');

  let { data: bucket, error: bucketError } = await admin.storage.getBucket(BUCKET);
  if (bucketError || !bucket) {
    const created = await admin.storage.createBucket(BUCKET, {
      public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: MIME,
    });
    if (created.error) throw new Error('Cannot create private bucket: ' + created.error.message);
    ({ data: bucket, error: bucketError } = await admin.storage.getBucket(BUCKET));
  }
  if (bucketError || !bucket) throw new Error('Unable to read bucket after creation');
  const limit = Number(bucket.file_size_limit ?? bucket.fileSizeLimit);
  const allowed = bucket.allowed_mime_types ?? bucket.allowedMimeTypes ?? [];
  const tightening = bucket.public !== false || limit !== MAX_BYTES ||
    MIME.some((type) => !allowed.includes(type));
  if (tightening) {
    const { error } = await admin.storage.updateBucket(BUCKET, {
      public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: MIME,
    });
    if (error) throw new Error('Cannot configure private bucket: ' + error.message);
  }
  const { data: checked, error: checkError } = await admin.storage.getBucket(BUCKET);
  const privateOk = !checkError && checked?.public === false &&
    Number(checked.file_size_limit ?? checked.fileSizeLimit) === MAX_BYTES;
  mark('private_storage_' + BUCKET, privateOk, privateOk ? 'private; 70 MiB cap; MIME allowlist configured' : 'bucket configuration mismatch');

  const vectorStart = performance.now();
  const embedding = await embedStudyText('Renal clearance, dose-response and competitive antagonism.', {
    taskType: 'RETRIEVAL_QUERY', timeoutMs: 12000,
  });
  const embedMs = Math.round((performance.now() - vectorStart) * 100) / 100;
  report.latency_ms.embedding = embedMs;
  const values = embedding.values;
  const norm = values && Math.hypot(...values);
  const vectorOk = !!values && values.length === 1536 &&
    Math.abs(norm - 1) < 1e-5 && embedMs < 500;
  mark('embedding_1536_under_500ms', vectorOk,
    'provider=' + embedding.provider + '; dimensions=' + (values?.length ?? 0) +
    '; norm=' + (norm?.toFixed(6) ?? 'n/a') + '; elapsed=' + embedMs + 'ms');

  const groqKey = requireEnv('GROQ_API_KEY');
  const geminiKey = requireEnv('GEMINI_API_KEY');
  // Benchmark both Groq models that the live tutor actually routes to.
  for (const [label, model] of [
    ['groq_barge_in', 'llama-3.1-8b-instant'],
    ['groq_teach', 'llama-3.3-70b-versatile'],
  ]) {
    try {
      const ms = await timeTTFT(label, 'https://api.groq.com/openai/v1/chat/completions',
        { authorization: 'Bearer ' + groqKey },
        { model, stream: true, max_completion_tokens: 24,
          messages: [{ role: 'user', content: 'Reply with one word: ready' }] },
        (frame) => typeof frame?.choices?.[0]?.delta?.content === 'string' &&
          !!frame.choices[0].delta.content.trim());
      mark(label + '_stream', true, 'first content token ' + ms + 'ms');
    } catch (error) {
      mark(label + '_stream', false, error.message);
    }
  }
  // The production fallback uses generateContent, NOT streaming; for that
  // path first usable content is available only after the full HTTP response.
  try {
    const started = performance.now();
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with one word: ready' }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 700,
            thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(20000),
      });
    if (!response.ok) throw new Error('Gemini fallback HTTP ' + response.status);
    const data = await response.json();
    const answer = data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || '';
    if (!answer.trim()) throw new Error('Gemini fallback returned no usable content');
    const ms = Math.round((performance.now()-started)*100)/100;
    report.latency_ms.gemini_actual_fallback_first_output = ms;
    mark('gemini_actual_fallback', true,
      'first usable non-streaming response ' + ms + 'ms (production fallback behavior)');
  } catch (error) {
    mark('gemini_actual_fallback', false, error.message);
  }
  report.pass = Object.values(report.checks).every((value) => value.ok);
} catch (error) {
  mark('preflight', false, error.message);
}
console.log('\nCUTOVER_PREFLIGHT_REPORT ' + JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
