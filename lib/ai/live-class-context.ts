import { buildTeachingContext } from '@/lib/ai/teaching-context';
import type { SupabaseClient } from '@supabase/supabase-js';

type LiveClassSeed = {
  courseName: string;
  topicFocus: string;
  knowledge: Array<{ title: string; course: string; excerpt: string }>;
  questions: Array<{ type: string; topic: string | null; question: string; answer: string }>;
};

export async function buildLiveClassSeed(
  supabase: SupabaseClient,
  courseName: string,
  topicFocus: string,
): Promise<LiveClassSeed> {
  try {
    const context = await buildTeachingContext(
      supabase,
      courseName,
      [{ role: 'user', content: topicFocus || courseName }],
    );
    return {
      courseName,
      topicFocus,
      knowledge: context.knowledgeSources.slice(0, 3).map((source) => ({
        title: source.title,
        course: source.course,
        excerpt: source.content?.trim().slice(0, 500) || '',
      })).filter((source) => source.excerpt),
      questions: context.questions.slice(0, 4).map((question) => ({
        type: question.type,
        topic: question.topic,
        question: question.question_text?.trim().slice(0, 420) || '',
        answer: (question.correct_answer || question.model_answer || '').trim().slice(0, 320),
      })).filter((question) => question.question),
    };
  } catch (error) {
    console.error('Live Class evidence seed failed:', error);
    return { courseName, topicFocus, knowledge: [], questions: [] };
  }
}
