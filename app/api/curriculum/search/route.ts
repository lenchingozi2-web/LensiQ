import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAccess } from '@/lib/gatekeeper';
import { courseSubject, getCurriculumCourse, getCurriculumTopic } from '@/lib/curriculum';
import { cleanSearchText, extractHighSignalTerms, searchQuestions } from '@/lib/curriculum-search';
import { extractLectureText } from '@/lib/curriculum/extract-text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function visibleResults<T extends { type: string }>(results: T[], hasPremiumAccess: boolean) {
  return hasPremiumAccess ? results : results.filter((result) => result.type !== 'practical');
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'You must be logged in to search the question bank.' }, { status: 401 });

    const formData = await request.formData();
    const rawQuery = typeof formData.get('query') === 'string' ? String(formData.get('query')) : '';
    const courseSlug = typeof formData.get('courseSlug') === 'string' ? String(formData.get('courseSlug')) : '';
    const topicSlug = typeof formData.get('topicSlug') === 'string' ? String(formData.get('topicSlug')) : '';
    const fileValue = formData.get('file');
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

    if (!rawQuery.trim() && !file) {
      return NextResponse.json({ error: 'Enter a word or topic, or upload a lecture document.' }, { status: 400 });
    }
    if (file && file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Lecture files must be twenty megabytes or smaller.' }, { status: 400 });
    }

    const course = courseSlug ? await getCurriculumCourse(supabase, courseSlug) : null;
    if (courseSlug && !course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    const topic = courseSlug && topicSlug ? (await getCurriculumTopic(supabase, courseSlug, topicSlug)).topic : null;
    if (topicSlug && !topic) return NextResponse.json({ error: 'Topic not found.' }, { status: 404 });

    const access = await checkAccess('browse', course ? courseSubject(course.name) : undefined);
    if (!access.allowed) return NextResponse.json({ error: access.message }, { status: access.status });

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan,plan_expires_at,role,selected_free_course')
      .eq('id', user.id)
      .maybeSingle();
    const hasPremiumAccess = Boolean(
      profile?.role === 'admin'
      || (profile?.plan && profile.plan !== 'free' && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date())),
    );
    const freeSubject = !hasPremiumAccess && !course ? profile?.selected_free_course : null;
    if (!hasPremiumAccess && !course && !freeSubject) {
      return NextResponse.json({ error: 'Choose your free course from Browse before using global search.' }, { status: 403 });
    }

    let extractedText = '';
    let sourceName = '';
    if (file) {
      sourceName = file.name;
      try {
        extractedText = await extractLectureText(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The lecture file could not be read.';
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const documentTerms = extractedText ? extractHighSignalTerms(extractedText) : '';
    // A typed query is authoritative. Do not append a whole topic title or lecture term list,
    // because that turns a focused search such as "inflammation" into an accidental AND query.
    const searchText = cleanSearchText(rawQuery.trim() || documentTerms || topic?.title || '');
    if (!searchText) return NextResponse.json({ error: 'No searchable text was found.' }, { status: 400 });

    const results = await searchQuestions(supabase, searchText, {
      course,
      topic,
      subjectFilter: freeSubject,
      limit: 30,
    });
    const safeResults = visibleResults(results, hasPremiumAccess);

    return NextResponse.json({
      query: rawQuery || topic?.title || sourceName,
      sourceName: sourceName || null,
      extractedCharacterCount: extractedText.length || null,
      results: safeResults,
      totalMatches: safeResults.length,
      practicalLocked: !hasPremiumAccess && results.some((result) => result.type === 'practical'),
    });
  } catch (error) {
    console.error('Curriculum search error:', error);
    return NextResponse.json({ error: 'Unable to search the curriculum right now.' }, { status: 500 });
  }
}
