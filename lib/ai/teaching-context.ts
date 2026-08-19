import type { SupabaseClient } from '@supabase/supabase-js';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type QuestionContext = {
  question_text: string | null;
  division: string | null;
  topic: string | null;
  type: string;
  correct_answer: string | null;
  model_answer: string | null;
};

type KnowledgeSource = {
  title: string;
  course: string;
  description: string | null;
  source_document: string | null;
  part_number: number | null;
  part_count: number | null;
};

function subjectForCourse(courseName: string) {
  return courseName.toLowerCase() === 'pharmacology' ? 'Pharmacology' : 'Pathology';
}

function wordsForSearch(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === 'user')
    .flatMap((message) => message.content.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
    .filter((word, index, words) => words.indexOf(word) === index)
    .slice(-16);
}

function relevanceScore(item: QuestionContext, searchWords: string[]) {
  const haystack = [item.question_text, item.division, item.topic, item.model_answer]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return searchWords.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

export async function buildTeachingContext(
  supabase: SupabaseClient,
  courseName: string,
  messages: ChatMessage[],
) {
  const subject = subjectForCourse(courseName);
  const searchWords = wordsForSearch(messages);

  const [{ data: questions }, { data: knowledgeSources }] = await Promise.all([
    supabase
      .from('questions')
      .select('question_text,division,topic,type,correct_answer,model_answer')
      .eq('subject', subject)
      .in('type', ['mcq', 'theory', 'practical'])
      .limit(120),
    supabase
      .from('knowledge_documents')
      .select('title,course,description,source_document,part_number,part_count')
      .eq('course', courseName)
      .eq('is_active', true)
      .order('source_document', { ascending: true })
      .order('part_number', { ascending: true })
      .limit(20),
  ]);

  const rankedQuestions = ((questions ?? []) as QuestionContext[])
    .map((question) => ({ question, score: relevanceScore(question, searchWords) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ question }) => question);

  return {
    subject,
    knowledgeSources: (knowledgeSources ?? []) as KnowledgeSource[],
    questions: rankedQuestions,
  };
}
