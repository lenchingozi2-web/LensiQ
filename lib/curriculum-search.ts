import type { SupabaseClient } from '@supabase/supabase-js';
import { courseSubject, type CurriculumCourse, type CurriculumTopic } from './curriculum';

export type QuestionSearchResult = {
  id: string;
  subject: string;
  division: string | null;
  topic: string | null;
  type: 'mcq' | 'theory' | 'practical' | string;
  year: number | null;
  question_text: string;
  image_url: string | null;
  correct_answer: string | null;
  model_answer: string | null;
  relevance: number;
};

const SEARCH_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'being', 'between', 'could', 'first', 'from', 'have', 'into',
  'more', 'other', 'over', 'such', 'than', 'their', 'there', 'these', 'those', 'through', 'under', 'which', 'with',
  'would', 'should', 'where', 'when', 'what', 'this', 'that', 'will', 'were', 'your', 'using', 'used', 'patient', 'patients',
]);

export function cleanSearchText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

export function extractHighSignalTerms(value: string, limit = 14) {
  const counts = new Map<string, number>();
  for (const word of value.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    const normalized = word.replace(/-/g, ' ');
    if (SEARCH_STOP_WORDS.has(normalized) || SEARCH_STOP_WORDS.has(word)) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([word]) => word)
    .join(' | ');
}

export async function searchQuestions(
  supabase: SupabaseClient,
  searchText: string,
  options?: { course?: CurriculumCourse | null; topic?: CurriculumTopic | null; subjectFilter?: string | null; limit?: number },
) {
  const cleanText = cleanSearchText(searchText);
  if (!cleanText) return [] as QuestionSearchResult[];
  const { data, error } = await supabase.rpc('search_question_bank', {
    search_text: cleanText,
    subject_filter: options?.course ? courseSubject(options.course.name) : options?.subjectFilter ?? null,
    division_filter: null,
    max_results: Math.min(Math.max(options?.limit ?? 40, 1), 100),
  });
  if (error) throw error;
  return (data ?? []) as QuestionSearchResult[];
}

export async function getKnowledgeSources(supabase: SupabaseClient, courseName: string) {
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select('id,title,course,description,source_filename,public_url,source_document,part_number,part_count')
    .eq('course', courseName)
    .eq('is_active', true)
    .order('source_document', { ascending: true })
    .order('part_number', { ascending: true })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}
