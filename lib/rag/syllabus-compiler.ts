import { createAdminClient } from '@/lib/supabase/admin';
import { parseUploadedDocument, chunkFacts, type ParsedDocument } from './ingestor';
import { processSyllabus } from './process-syllabus';
import { embedStudyText } from './embeddings';
import { matchCuratedClassVisual } from '@/lib/live-class/model-matcher';

type Progress = { stage: string; current: number; total: number; detail?: string; syllabusId?: string };
const BUCKET = 'study-documents';
const emit = (stage: string, current: number, total: number, detail?: string): Progress => ({ stage, current, total, detail });

function ensureNoError(error: { message?: string } | null, context: string): void {
  if (error) throw new Error(context + ': ' + error.message);
}

export async function* compileStudySyllabus(userId: string, syllabusId: string): AsyncGenerator<Progress> {
  const admin = createAdminClient();
  if (!admin) throw new Error('Study syllabus service configuration is missing');
  const { data: syllabus, error: fetchError } = await admin.from('study_syllabi')
    .select('id,user_id,status,active_generation,expires_at')
    .eq('id', syllabusId).eq('user_id', userId).maybeSingle();
  ensureNoError(fetchError, 'Read syllabus');
  if (!syllabus || syllabus.status === 'ended' || syllabus.status === 'purged') throw new Error('This syllabus cannot be compiled');
  if (new Date(syllabus.expires_at).getTime() <= Date.now()) throw new Error('Syllabus session expired');
  const generation = syllabus.active_generation + 1;
  const { data: locked, error: lockError } = await admin.from('study_syllabi')
    .update({ status: 'compiling', staging_generation: generation, updated_at: new Date().toISOString() })
    .eq('id', syllabusId).eq('user_id', userId)
    .in('status', ['draft', 'ready', 'failed'])
    .select('id').maybeSingle();
  ensureNoError(lockError, 'Reserve compilation');
  if (!locked) throw new Error('Compilation is already in progress');
  try {
    const { data: docs, error: documentError } = await admin.from('study_documents')
      .select('id,original_name,storage_path,status')
      .eq('syllabus_id', syllabusId).eq('user_id', userId).in('status', ['uploaded', 'indexed']).order('created_at');
    ensureNoError(documentError, 'Read documents');
    if (!docs?.length) throw new Error('No confirmed uploads to compile');
    yield emit('parsing', 0, docs.length);
    const parsed: ParsedDocument[] = [];
    for (let i = 0; i < docs.length; i++) {
      const document = docs[i];
      const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(document.storage_path);
      ensureNoError(downloadError, 'Read upload ' + document.original_name);
      if (!blob) throw new Error('Missing source file: ' + document.original_name);
      parsed.push(await parseUploadedDocument(new Uint8Array(await blob.arrayBuffer()), document.id, document.original_name));
      yield emit('parsing', i + 1, docs.length, document.original_name);
    }
    const concepts = processSyllabus(parsed);
    if (!concepts.length) throw new Error('No readable concepts were extracted');
    // A failed retry can reuse this generation, but must not expose incomplete old rows.
    const { error: oldChunkError } = await admin.from('document_atomic_chunks').delete()
      .eq('syllabus_id', syllabusId).eq('generation', generation).eq('user_id', userId);
    ensureNoError(oldChunkError, 'Clear unsuccessful staging chunks');
    const { error: oldNodeError } = await admin.from('syllabus_concept_nodes').delete()
      .eq('syllabus_id', syllabusId).eq('generation', generation).eq('user_id', userId);
    ensureNoError(oldNodeError, 'Clear unsuccessful staging nodes');
    const modules = new Map<string, string>();
    const topics = new Map<string, string>();
    let chunkCount = 0;
    yield emit('compiling', 0, concepts.length);
    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];
      let moduleId = modules.get(concept.module);
      if (!moduleId) {
        const { data, error } = await admin.from('syllabus_concept_nodes').insert({
          syllabus_id: syllabusId, user_id: userId, generation, node_type: 'module',
          title: concept.module, sort_order: i,
        }).select('id').single();
        ensureNoError(error, 'Create module');
        moduleId = data!.id;
        modules.set(concept.module, moduleId!);
      }
      const topicKey = concept.module + '\u0000' + concept.topic;
      let topicId = topics.get(topicKey);
      if (!topicId) {
        const { data, error } = await admin.from('syllabus_concept_nodes').insert({
          syllabus_id: syllabusId, user_id: userId, generation, node_type: 'topic',
          parent_id: moduleId, title: concept.topic, sort_order: i,
        }).select('id').single();
        ensureNoError(error, 'Create topic');
        topicId = data!.id;
        topics.set(topicKey, topicId!);
      }
      const { data: node, error: nodeError } = await admin.from('syllabus_concept_nodes').insert({
        syllabus_id: syllabusId, user_id: userId, generation, node_type: 'concept',
        parent_id: topicId, title: concept.title, sort_order: i,
        consolidated_notes: concept.notes,
        key_details_json: concept.facts,
        source_citations_json: concept.citations,
        visual_spec_json: matchCuratedClassVisual(concept.title) || { mode: 'whiteboard', title: concept.title },
      }).select('id').single();
      ensureNoError(nodeError, 'Create concept');
      const chunks = chunkFacts(concept.sourceFacts);
      // The atomic chunks, never a compressed AI abstract, are the authoritative evidence store.
      for (const chunk of chunks) {
        const result = await embedStudyText(chunk.text, { taskType: 'RETRIEVAL_DOCUMENT' });
        const { error } = await admin.from('document_atomic_chunks').insert({
          syllabus_id: syllabusId, user_id: userId, generation, concept_node_id: node!.id,
          document_id: chunk.documentId, chunk_text: chunk.text, source_file: chunk.sourceFile,
          page_number: chunk.pageNumber, embedding: result.values ? '[' + result.values.join(',') + ']' : null,
        });
        ensureNoError(error, 'Index source chunk');
        chunkCount++;
      }
      yield emit('compiling', i + 1, concepts.length, concept.title);
    }
    // One conditional UPDATE publishes the new generation atomically. Readers never see staging rows.
    const { data: published, error: publishError } = await admin.from('study_syllabi')
      .update({ status: 'ready', active_generation: generation, staging_generation: null, updated_at: new Date().toISOString() })
      .eq('id', syllabusId).eq('user_id', userId).eq('staging_generation', generation)
      .select('id').maybeSingle();
    ensureNoError(publishError, 'Publish syllabus');
    if (!published) throw new Error('Compilation generation superseded');
    const { error: docsError } = await admin.from('study_documents').update({ status: 'indexed' })
      .eq('syllabus_id', syllabusId).eq('user_id', userId).in('status', ['uploaded', 'indexed']);
    ensureNoError(docsError, 'Mark indexed documents');
    yield emit('ready', concepts.length, concepts.length, concepts.length + ' concepts and ' + chunkCount + ' source chunks');
  } catch (error) {
    await admin.from('study_syllabi')
      .update({ status: syllabus.active_generation > 0 ? 'ready' : 'failed', staging_generation: null })
      .eq('id', syllabusId).eq('user_id', userId).eq('staging_generation', generation);
    throw error;
  }
}
