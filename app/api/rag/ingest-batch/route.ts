import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLectureFileExtension } from '@/lib/curriculum/file-types';
import { buildTeachingContext } from '@/lib/ai/teaching-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { includesLiveClass } from '@/lib/plans';
import { buildCourseLesson } from '@/lib/live-class/course-lesson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration=60;
const BUCKET = 'study-documents';
const MAX_BYTES = 70 * 1024 * 1024;
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role,plan,plan_expires_at').eq('id', user.id).maybeSingle();
  const hasPlan = profile?.role === 'admin' || (profile?.plan && includesLiveClass(profile.plan)
    && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date()));
  if (!hasPlan) return NextResponse.json({ error: 'Active Live Class subscription required' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  if (body.action === 'course'){
    const course=typeof body.course==='string'?body.course.trim().slice(0,100):'';
    const admin=createAdminClient();
    if(!course||!admin)return NextResponse.json({error:'Course context unavailable'},{status:503});
    const context=await buildTeachingContext(admin,course,[{role:'user',content:String(body.focus||course).slice(0,300)}]);
    try{
      const text=await buildCourseLesson(course,String(body.focus||'').slice(0,300),context);
      return NextResponse.json({text,sourceMode:'course-knowledge-and-bank'});
    }catch{return NextResponse.json({error:'The tutor could not prepare this course lesson. Please retry.'},{status:503});}
  }
  if (body.action === 'confirm') {
    const documentId = typeof body.documentId === 'string' ? body.documentId : '';
    if (!UUID.test(documentId)) return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    const { data, error } = await supabase.rpc('confirm_study_document', { p_document_id: documentId });
    if (error) return NextResponse.json({ error: 'Upload not verified: ' + error.message }, { status: 422 });
    return NextResponse.json({ ok: true, actualSize: data });
  }
  if (body.action !== 'prepare' || !Array.isArray(body.files) || !body.files.length || body.files.length > 25)
    return NextResponse.json({ error: 'Select 1–25 documents' }, { status: 400 });
  const files = body.files.map((file: unknown) => {
    const value = (typeof file === 'object' && file !== null ? file : {}) as { name?: unknown; size?: unknown; type?: unknown };
    return { name: typeof value.name === 'string' ? value.name.trim().slice(0, 180) : '',
      size: Number(value.size), type: typeof value.type === 'string' ? value.type : '' };
  });
  if (files.some((file: { name: string; size: number; type: string }) =>
    !getLectureFileExtension(file.name, file.type) || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_BYTES)
    || files.reduce((sum: number, file: { size: number }) => sum + file.size, 0) > MAX_BYTES)
    return NextResponse.json({ error: 'Unsupported file or 70 MiB quota exceeded' }, { status: 413 });
  let syllabusId = typeof body.syllabusId === 'string' && UUID.test(body.syllabusId) ? body.syllabusId : null;
  if (!syllabusId) {
    const sessionId = typeof body.sessionId === 'string' && UUID.test(body.sessionId) ? body.sessionId : null;
    if (sessionId) {
      const { data: session } = await supabase.from('live_class_sessions').select('id').eq('id',sessionId).eq('user_id', user.id).eq('status','active').maybeSingle();
      if (!session) return NextResponse.json({ error: 'Active owned class required' }, { status: 403 });
    }
    const { data: syllabus, error } = await supabase.from('study_syllabi')
      .insert({ user_id: user.id, session_id: sessionId, status: 'draft' }).select('id').single();
    if (error || !syllabus) return NextResponse.json({ error: 'Unable to create syllabus' }, { status: 500 });
    syllabusId = syllabus.id;
  }
  const { data: reservations, error: reserveError } = await supabase.rpc('reserve_study_documents', {
    p_syllabus_id: syllabusId,
    p_files: files.map((file: { name: string; size: number }) => ({ name: file.name, size: file.size })),
  });
  if (reserveError || !Array.isArray(reservations))
    return NextResponse.json({ error: 'Upload quota or reservation failed: ' + (reserveError?.message || 'unknown') }, { status: 409 });
  const uploads = [];
  try {
    for (const reservation of reservations) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(reservation.storage_path);
      if (error || !data?.path || !data?.token) throw new Error('Unable to sign upload');
      uploads.push({ documentId: reservation.document_id, fileName: reservation.original_name,
        path: data.path, token: data.token });
    }
  } catch {
    // Reservation remains visible and expires with the syllabus. Never silently exceed a quota.
    return NextResponse.json({ error: 'Failed to prepare all signed URLs; end this syllabus and retry with a new one.' }, { status: 503 });
  }
  return NextResponse.json({ syllabusId, uploads, maxFiles: 25, maxBytes: MAX_BYTES });
}
