import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractLectureText } from '@/lib/curriculum/extract-text';
import { getLectureFileExtension, isSupportedLectureFile, normalizeLectureFileName, normalizeLectureMimeType } from '@/lib/curriculum/file-types';
import { detectMaterialBranches } from '@/lib/curriculum/material-profile';
import { includesLiveClass } from '@/lib/plans';
import { createClassMaterialMap } from '@/lib/ai/live-class-material-map';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STORAGE_BUCKET = 'ephemeral_class_materials';
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function safeBaseName(fileName: string) {
  return (fileName.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._-]+|[._-]+$/g, '').slice(0, 120) || 'lecture-material');
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in before uploading Live Class material.' }, { status: 401 });
  const { data: accessProfile } = await supabase.from('profiles').select('role, plan, plan_expires_at').eq('id', user.id).maybeSingle();
  const activePlan = Boolean(accessProfile?.plan && includesLiveClass(accessProfile.plan)
    && (!accessProfile.plan_expires_at || new Date(accessProfile.plan_expires_at) > new Date()));
  if (accessProfile?.role !== 'admin' && !activePlan) {
    return NextResponse.json({ error: 'Lecture uploads for Live Class require an active All Access plan.' }, { status: 403 });
  }

  // Large files go directly from the learner's browser to private Supabase
  // Storage. A 20 MB PDF must not transit Vercel's small request-body limit.
  let value: File;
  let temporarySourcePath: string | null = null;
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    if (body.action === 'prepare') {
      const fileName = typeof body.fileName === 'string' ? body.fileName.slice(0, 180) : '';
      const mimeType = typeof body.mimeType === 'string' ? body.mimeType.slice(0, 130) : '';
      const fileSize = Number(body.fileSize);
      if (!isSupportedLectureFile(fileName, mimeType) || !Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Choose a supported PDF, DOC, DOCX, PPTX or TXT file smaller than 20 MB.' }, { status: 400 });
      }
      const extension = getLectureFileExtension(fileName, mimeType);
      const uploadPath = `${user.id}/class_${crypto.randomUUID()}/${safeBaseName(fileName)}.${extension}`;
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(uploadPath);
      if (error || !data?.token) {
        return NextResponse.json({ error: 'Unable to prepare a secure lecture upload.' }, { status: 500 });
      }
      return NextResponse.json({ path: uploadPath, token: data.token });
    }
    if (body.action !== 'parse' || typeof body.path !== 'string') {
      return NextResponse.json({ error: 'Invalid lecture upload request.' }, { status: 400 });
    }
    const rawPath = body.path;
    const rawName = rawPath.split('/').at(-1) || '';
    const allowed = rawPath.startsWith(`${user.id}/class_`)
      && /^[a-f0-9-]{36}$/.test(rawPath.split('/')[1]?.replace(/^class_/, '') || '')
      && /^[a-z0-9._-]+\.(?:pdf|doc|docx|pptx|txt)$/i.test(rawName)
      && rawPath.split('/').length === 3 && !rawPath.includes('..');
    if (!allowed) return NextResponse.json({ error: 'Invalid lecture upload path.' }, { status: 403 });
    temporarySourcePath = rawPath;
    const { data: downloaded, error } = await supabase.storage.from(STORAGE_BUCKET).download(rawPath);
    if (error || !downloaded) return NextResponse.json({ error: 'The uploaded lecture could not be retrieved for parsing.' }, { status: 422 });
    if (downloaded.size > MAX_FILE_SIZE || downloaded.size <= 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove([rawPath]);
      return NextResponse.json({ error: 'The uploaded lecture is empty or exceeds 20 MB.' }, { status: 413 });
    }
    value = new File([await downloaded.arrayBuffer()], rawName, { type: normalizeLectureMimeType(rawName) });
  } else {
    // Compatibility for existing small-file clients.
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'The lecture file could not be read.' }, { status: 400 });
    }
    const submitted = formData.get('file');
    if (!(submitted instanceof File)) return NextResponse.json({ error: 'Choose a lecture file.' }, { status: 400 });
    value = submitted;
  }
  if (value.size <= 0 || value.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Lecture files must be 20 MB or smaller.' }, { status: 413 });
  if (!isSupportedLectureFile(value.name, value.type)) {
    return NextResponse.json({ error: 'Use PDF, DOC, DOCX, PPTX or TXT files.' }, { status: 415 });
  }
  let extractedText: string;
  try {
    const normalizedName = normalizeLectureFileName(value.name, value.type);
    const normalizedFile = new File([await value.arrayBuffer()], normalizedName, { type: normalizeLectureMimeType(normalizedName, value.type) });
    extractedText = await extractLectureText(normalizedFile);
  } catch (parseError) {
    console.error('Live Class document extraction error', {
      extension: getLectureFileExtension(value.name, value.type),
      errorType: parseError instanceof Error ? parseError.name : 'unknown',
    });
    if (temporarySourcePath) await supabase.storage.from(STORAGE_BUCKET).remove([temporarySourcePath]);
    return NextResponse.json({
      error: 'This file could not be parsed. Check that the PDF is readable and not password-protected or image-only. Scanned PDFs currently need a text-readable version.',
    }, { status: 422 });
  }
  if (!extractedText.trim()) {
    if (temporarySourcePath) await supabase.storage.from(STORAGE_BUCKET).remove([temporarySourcePath]);
    return NextResponse.json({ error: 'No readable text was found. Scanned or image-only files need OCR or a text-readable version.' }, { status: 422 });
  }

  const outputName = `${safeBaseName(value.name)}.parsed.txt`;
  const storagePath = `${user.id}/class_${crypto.randomUUID()}/${outputName}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, Buffer.from(extractedText, 'utf8'), { contentType: 'text/plain; charset=utf-8', upsert: false });
  if (uploadError) {
    console.error('Live Class DOC extraction upload failed:', uploadError);
    return NextResponse.json({ error: 'The extracted lecture text could not be saved for this class. Please try again.' }, { status: 500 });
  }

  const { data: signedData, error: signedError } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 2 * 60 * 60);
  if (signedError || !signedData?.signedUrl) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: 'The tutor could not be given temporary access to this lecture file. Please retry.' }, { status: 500 });
  }

  let materialMapUrl: string | null = null;
  try {
    const materialMap = await createClassMaterialMap(extractedText, value.name);
    const mapPath = storagePath.replace(/\.parsed\.txt$/, '.class-map.json');
    const { error: mapError } = await supabase.storage.from(STORAGE_BUCKET)
      .upload(mapPath, Buffer.from(JSON.stringify(materialMap), 'utf8'), {contentType:'application/json',upsert:false});
    if (!mapError) {
      const {data: mapLink} = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(mapPath, 2 * 60 * 60);
      materialMapUrl = mapLink?.signedUrl || null;
    }
  } catch {
    console.warn('Structured class mapping unavailable; extracted lecture text remains accessible.');
  }
  if (temporarySourcePath) {
    await supabase.storage.from(STORAGE_BUCKET).remove([temporarySourcePath]).catch(() => undefined);
  }
  const profile = detectMaterialBranches(extractedText, value.name, extractedText.length);
  return NextResponse.json({
    path: storagePath,
    materialMapUrl,
    signedUrl: signedData.signedUrl,
    parsed: true,
    sourceFileName: value.name,
    sourceExtension: getLectureFileExtension(value.name, value.type),
    extractedCharacterCount: extractedText.length,
    materialProfile: profile,
  });
}
