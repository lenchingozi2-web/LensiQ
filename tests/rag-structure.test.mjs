import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { embedStudyText, lexicalSimilarity, normalizeEmbedding } from '../lib/rag/embeddings.ts';
import { uniqueFacts, compileCanonicalConcept } from '../lib/rag/deduplicator.ts';

const normal = Array.from({ length: 1536 }, (_, i) => i % 2 ? 0 : 3);
test('Gemini fallback uses 1536 dimensions and deterministic L2 normalization', async () => {
  let called = '';
  const fake = async (url, request) => {
    called = url;
    assert.equal(JSON.parse(request.body).outputDimensionality, 1536);
    return { ok: true, json: async () => ({ embedding: { values: normal } }) };
  };
  const result = await embedStudyText('renal physiology', { env: { GEMINI_API_KEY: 'test-key' }, fetcher: fake });
  assert.equal(result.provider, 'gemini');
  assert.match(called, /gemini-embedding-001:embedContent/);
  assert.equal(result.values.length, 1536);
  assert.ok(Math.abs(Math.hypot(...result.values) - 1) < 1e-12);
  assert.deepEqual(result.values, normalizeEmbedding(normal));
});
test('failure gracefully uses lexical offline fallback', async () => {
  const result = await embedStudyText('baroreceptors', { env: {}, fetcher: async () => { throw Error('offline'); } });
  assert.equal(result.provider, 'lexical');
  assert.equal(result.values, null);
  assert.ok(lexicalSimilarity('glomerular filtration rate', 'filtration in glomerular capillaries') > 0);
  assert.throws(() => normalizeEmbedding([1, 2]), /1536/);
});
test('only exact duplicate statements are removed; exceptions and sources persist', () => {
  const source = [{ text:'Dose is 5 mg.', documentId:'a', sourceFile:'a.pdf', pageNumber:1 },
    { text:'Dose is 5 mg.', documentId:'b', sourceFile:'b.pdf', pageNumber:2 },
    { text:'Dose is 5 mg except in renal failure.', documentId:'b', sourceFile:'b.pdf', pageNumber:2 }];
  const result = compileCanonicalConcept('Dose', source);
  assert.equal(uniqueFacts(source).length, 2);
  assert.equal(result.facts.length, 2);
  assert.equal(result.citations.length, 2);
  assert.match(result.notes, /renal failure/);
});
test('private schema, quota, generation and hybrid indexes are declared', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261116180000_deterministic_syllabus_rag.sql', import.meta.url),'utf8');
  for (const token of ['study_syllabi','study_documents','syllabus_concept_nodes','document_atomic_chunks','73400320',
    'vector(1536)','using hnsw','using gin','search_study_chunks','active_generation',
    'enable row level security','confirm_study_document']) assert.ok(sql.includes(token), token);
});
