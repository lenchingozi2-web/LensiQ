import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkAccess } from '@/lib/gatekeeper';
import { courseSubject, getCurriculumCourse, getCurriculumTopic } from '@/lib/curriculum';
import { cleanSearchText, extractHighSignalTerms, searchQuestions } from '@/lib/curriculum-search';
import { extractLectureText } from '@/lib/curriculum/extract-text';
import { isFreeAnatomicalPathologySystem } from '@/lib/practical-catalogue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORAGE_BUCKET = 'teaching-attachments';
const MAX_FILE_SIZE = 20 * 1024 * 1024;

type SearchPayload = {
  query?: string;
  courseSlug?: string;
  topicSlug?: string;
  storagePath?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

function visibleResults<T extends { subject: string; type: string; division?: string | null }>(results: T[], hasPremiumAccess: boolean, selectedFreePracticalBranch?: string | null) {
  return hasPremiumAccess ? results : results.filter((result) => result.type !== 'practical' || (result.subject.toLowerCase() === 'pathology' && isFreeAnatomicalPathologySystem(result.division ?? '', selectedFreePracticalBranch)));
}

async function readSearchPayload(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    return { payload: body as SearchPayload, file: null as File | null };
  }
  const formData = await request.formData();
  const fileValue = formData.get('file');
  return {
    payload: {
      query: typeof formData.get('query') === 'string' ? String(formData.get('query')) : '',
      courseSlug: typeof formData.get('courseSlug') === 'string' ? String(formData.get('courseSlug')) : '',
      topicSlug: typeof formData.get('topicSlug') === 'string' ? String(formData.get('topicSlug')) : '',
    },
    file: fileValue instanceof File && fileValue.size > 0 ? fileValue : null,
  };
}

export async function POST(request: Request) {
  let temporaryStoragePath: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'You must be logged in to search the question bank.' }, { status: 401 });

    const { payload, file: multipartFile } = await readSearchPayload(request);
    const rawQuery = typeof payload.query === 'string' ? payload.query : '';
    const courseSlug = typeof payload.courseSlug === 'string' ? payload.courseSlug : '';
    const topicSlug = typeof payload.topicSlug === 'string' ? payload.topicSlug : '';
    let file = multipartFile;
    let sourceName = '';

    if (payload.storagePath) {
      const expectedPrefix = `${user.id}/search/`;
      if (!payload.storagePath.startsWith(expectedPrefix)) return NextResponse.json({ error: 'This lecture upload does not belong to your account.' }, { status: 403 });
      if (!payload.fileName || !payload.mimeType) return NextResponse.json({ error: 'The lecture upload metadata is incomplete.' }, { status: 400 });
      if (payload.sizeBytes && payload.sizeBytes > MAX_FILE_SIZE) return NextResponse.json({ error: 'Lecture files must be 20 MB or smaller.' }, { status: 413 });
      temporaryStoragePath = payload.storagePath;
      const { data: blob, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(payload.storagePath);
      if (downloadError || !blob) return NextResponse.json({ error: 'The uploaded lecture could not be retrieved. Please upload it again.' }, { status: 400 });
      if (blob.size <= 0 || blob.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Lecture files must be between 1 byte and 20 MB.' }, { status: 413 });
      file = new File([await blob.arrayBuffer()], payload.fileName, { type: payload.mimeType });
      sourceName = payload.fileName;
    }

    if (!rawQuery.trim() && !file && !topicSlug) return NextResponse.json({ error: 'Enter a word or topic, or upload a lecture document.' }, { status: 400 });
    if (file && (file.size <= 0 || file.size > MAX_FILE_SIZE)) return NextResponse.json({ error: 'Lecture files must be between 1 byte and 20 MB.' }, { status: 413 });

    const course = courseSlug ? await getCurriculumCourse(supabase, courseSlug) : null;
    if (courseSlug && !course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    const topic = courseSlug && topicSlug ? (await getCurriculumTopic(supabase, courseSlug, topicSlug)).topic : null;
    if (topicSlug && !topic) return NextResponse.json({ error: 'Topic not found.' }, { status: 404 });

    const access = await checkAccess('browse', course ? courseSubject(course.name) : undefined);
    if (!access.allowed) return NextResponse.json({ error: access.message }, { status: access.status });

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan,plan_expires_at,role,selected_free_course,selected_free_practical_branch')
      .eq('id', user.id)
      .maybeSingle();
    const hasPremiumAccess = Boolean(
      profile?.role === 'admin'
      || (profile?.plan && profile.plan !== 'free' && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date())),
    );
    const freeSubject = !hasPremiumAccess && !course ? profile?.selected_free_course : null;
    if (!hasPremiumAccess && !course && !freeSubject) return NextResponse.json({ error: 'Choose your free course from Browse before using global search.' }, { status: 403 });

    let extractedText = '';
    if (file) {
      try {
        extractedText = await extractLectureText(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The lecture file could not be read.';
        return NextResponse.json({ error: message }, { status: 400 });
      }
      if (!extractedText.trim()) return NextResponse.json({ error: 'The lecture file was uploaded, but no readable text was found. Try an exported PDF/PPTX/DOCX or type a focused term as well.' }, { status: 422 });
    }

    const documentTerms = extractedText ? extractHighSignalTerms(extractedText) : '';
    const searchText = cleanSearchText(rawQuery.trim() || documentTerms || topic?.title || '');
    if (!searchText) return NextResponse.json({ error: 'No searchable text was found in this lecture file. Try a text-based document or enter a query.' }, { status: 422 });

    const results = await searchQuestions(supabase, searchText, { course, topic, subjectFilter: freeSubject, limit: 30 });
    const safeResults = visibleResults(results, hasPremiumAccess, profile?.selected_free_practical_branch);

    return NextResponse.json({
      query: rawQuery || topic?.title || sourceName,
      sourceName: sourceName || null,
      extractedCharacterCount: extractedText.length || null,
      results: safeResults,
      totalMatches: safeResults.length,
      practicalLocked: !hasPremiumAccess && results.some((result) => result.type === 'practical' && !safeResults.includes(result)),
    });
  } catch (error) {
    console.error('Curriculum search error:', error);
    return NextResponse.json({ error: 'Unable to search the curriculum right now. Please try again with a smaller text-based file or a typed query.' }, { status: 500 });
  } finally {
    if (temporaryStoragePath) {
      const supabase = await createClient();
      await supabase.storage.from(STORAGE_BUCKET).remove([temporaryStoragePath]).catch(() => undefined);
    }
  }
}
