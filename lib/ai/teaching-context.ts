import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanSearchText } from '@/lib/curriculum-search';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type QuestionContext = {
  question_text: string | null;
  division: string | null;
  topic: string | null;
  type: string;
  correct_answer: string | null;
  model_answer: string | null;
};

type KnowledgeChunk = {
  document_id: string;
  course: string;
  chunk_index: number;
  content: string;
  relevance: number | null;
};

type KnowledgeSource = {
  title: string;
  course: string;
  description: string | null;
  source_document: string | null;
  part_number: number | null;
  part_count: number | null;
  chunk_index: number | null;
  content: string | null;
  relevance: number | null;
};

function subjectForCourse(courseName: string) {
  return courseName.toLowerCase() === 'pharmacology' ? 'Pharmacology' : 'Pathology';
}

function knowledgeCoursesForBranch(courseName: string) {
  const normalized = courseName.toLowerCase();
  if (normalized.includes('anatomical pathology')) return ['Anatomical Pathology'];
  if (normalized.includes('chemical pathology')) return ['Chemical Pathology'];
  if (normalized.includes('haematology') || normalized.includes('hematology')) {
    return ['Haematology/Immunology'];
  }
  if (normalized.includes('microbiology')) return ['Microbiology'];
  if (normalized.includes('pharmacology')) return ['Pharmacology'];
  if (normalized.includes('pathology')) return ['Anatomical Pathology', 'Chemical Pathology'];
  return [courseName];
}

function evidenceQuery(messages: ChatMessage[]) {
  return cleanSearchText(
    messages
      .filter((message) => message.role === 'user')
      .slice(-3)
      .map((message) => message.content)
      .join(' '),
  );
}

export async function buildTeachingContext(
  supabase: SupabaseClient,
  courseName: string,
  messages: ChatMessage[],
) {
  const subject = subjectForCourse(courseName);
  const searchText = evidenceQuery(messages) || courseName;
  const knowledgeCourses = knowledgeCoursesForBranch(courseName);

  const chunkSearches = await Promise.all(
    knowledgeCourses.map(async (courseFilter) => {
      const { data } = await supabase.rpc('search_knowledge_chunks', {
        search_text: searchText,
        course_filter: courseFilter,
        max_results: 12,
      });
      return (data ?? []) as KnowledgeChunk[];
    }),
  );

  const rankedChunks = chunkSearches
    .flat()
    .sort((left, right) => (right.relevance ?? 0) - (left.relevance ?? 0))
    .slice(0, 12);

  const [{ data: metadata }, { data: rankedQuestions }] = await Promise.all([
    supabase
      .from('knowledge_documents')
      .select('id,title,course,description,source_document,part_number,part_count')
      .in('course', knowledgeCourses)
      .eq('is_active', true)
      .order('source_document', { ascending: true })
      .order('part_number', { ascending: true })
      .limit(30),
    supabase.rpc('search_question_bank', {
      search_text: searchText,
      subject_filter: subject,
      division_filter: null,
      max_results: 16,
    }),
  ]);

  const metadataById = new Map(
    (metadata ?? []).map((source) => [source.id as string, source]),
  );
  const knowledgeSources: KnowledgeSource[] = rankedChunks.map((chunk) => {
    const source = metadataById.get(chunk.document_id);
    return {
      title: source?.title ?? `${chunk.course} knowledge-bank excerpt`,
      course: chunk.course,
      description: source?.description ?? null,
      source_document: source?.source_document ?? null,
      part_number: source?.part_number ?? null,
      part_count: source?.part_count ?? null,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      relevance: chunk.relevance,
    };
  });

  let questions = (rankedQuestions ?? []) as QuestionContext[];
  if (questions.length === 0) {
    const { data: fallbackQuestions } = await supabase
      .from('questions')
      .select('question_text,division,topic,type,correct_answer,model_answer')
      .eq('subject', subject)
      .in('type', ['mcq', 'theory', 'practical'])
      .limit(80);
    questions = (fallbackQuestions ?? []) as QuestionContext[];
  }

  return {
    subject,
    knowledgeSources,
    questions,
  };
}
