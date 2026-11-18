import { createClient } from '@/lib/supabase/server';
import { embedStudyText, lexicalSimilarity } from '@/lib/rag/embeddings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

export async function POST(request: Request) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const syllabusId = typeof body?.syllabusId === 'string' ? body.syllabusId : '';
  const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 1000) : '';
  if (!UUID.test(syllabusId) || !query) return Response.json({ error: 'Syllabus ID and query required' }, { status: 400 });
  // Authenticated SQL enforces owner ID and active generation; no service-role key is used for searching.
  const embedding = body?.searchMode === 'semantic'
    ? await embedStudyText(query, { taskType: 'RETRIEVAL_QUERY', timeoutMs: 1800 })
    : { provider: 'lexical' as const, values: null };
  const { data, error } = await client.rpc('match_study_concepts_hybrid', {
    p_syllabus_id: syllabusId, p_query: query,
    p_embedding: embedding.values ? '[' + embedding.values.join(',') + ']' : null,
    p_limit: 12,
  });
  if (error) return Response.json({ error: 'Study search unavailable: ' + error.message }, { status: 503 });
  const matches = (data || []).map((row: { id: string; chunk_text: string; score: number; source_file: string; page_number: number | null; concept_node_id: string | null }) => ({
    id: row.id, conceptNodeId: row.concept_node_id, text: row.chunk_text,
    source: { fileName: row.source_file, pageOrSlide: row.page_number },
    score: row.score + (embedding.values ? 0 : lexicalSimilarity(query, row.chunk_text) / 100),
  }));
  return Response.json({ syllabusId, provider: embedding.provider, matches });
}
