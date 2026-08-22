import type { SupabaseClient } from '@supabase/supabase-js';

export type CurriculumCourse = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent_color: string;
  display_order: number;
};

export type CurriculumTopic = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  day_number: number;
  day_title: string;
  order_index: number;
  subtopics: string[];
};

export const CURRICULUM_COURSES = [
  'Anatomical Pathology',
  'Chemical Pathology',
  'Haematology / Immunology',
  'Microbiology',
  'Pharmacology',
] as const;

export function courseSubject(courseName: string) {
  return courseName === 'Pharmacology' ? 'Pharmacology' : 'Pathology';
}

export async function getCurriculumCourses(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('curriculum_courses')
    .select('id,slug,name,description,accent_color,display_order')
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CurriculumCourse[];
}

export async function getCurriculumCourse(supabase: SupabaseClient, slug: string) {
  const { data, error } = await supabase
    .from('curriculum_courses')
    .select('id,slug,name,description,accent_color,display_order')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CurriculumCourse | null;
}

export async function getCurriculumTopics(supabase: SupabaseClient, courseId: string) {
  const { data, error } = await supabase
    .from('curriculum_topics')
    .select('id,course_id,slug,title,day_number,day_title,order_index,subtopics')
    .eq('course_id', courseId)
    .order('day_number', { ascending: true })
    .order('order_index', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((topic) => ({ ...topic, subtopics: Array.isArray(topic.subtopics) ? topic.subtopics : [] })) as CurriculumTopic[];
}

export async function getCurriculumTopic(supabase: SupabaseClient, courseSlug: string, topicSlug: string) {
  const course = await getCurriculumCourse(supabase, courseSlug);
  if (!course) return { course: null, topic: null };
  const { data, error } = await supabase
    .from('curriculum_topics')
    .select('id,course_id,slug,title,day_number,day_title,order_index,subtopics')
    .eq('course_id', course.id)
    .eq('slug', topicSlug)
    .maybeSingle();
  if (error) throw error;
  return { course, topic: data ? ({ ...data, subtopics: Array.isArray(data.subtopics) ? data.subtopics : [] } as CurriculumTopic) : null };
}
