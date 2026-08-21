import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurriculumCourse, getCurriculumCourses, getCurriculumTopics } from '@/lib/curriculum';
import { getKnowledgeSources } from '@/lib/curriculum-search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const url = new URL(request.url);
    const courseSlug = url.searchParams.get('course')?.trim();
    const courses = await getCurriculumCourses(supabase);

    if (!courseSlug) return NextResponse.json({ courses });

    const course = await getCurriculumCourse(supabase, courseSlug);
    if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    const [topics, knowledgeSources] = await Promise.all([
      getCurriculumTopics(supabase, course.id),
      getKnowledgeSources(supabase, course.name),
    ]);
    return NextResponse.json({ courses, course, topics, knowledgeSources });
  } catch (error) {
    console.error('Curriculum API error:', error);
    return NextResponse.json({ error: 'Unable to load the curriculum.' }, { status: 500 });
  }
}
