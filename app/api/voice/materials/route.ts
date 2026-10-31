import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractLectureText } from '@/lib/curriculum/extract-text';
import { getLectureFileExtension, isSupportedLectureFile, normalizeLectureFileName, normalizeLectureMimeType } from '@/lib/curriculum/file-types';
import { detectMaterialBranches } from '@/lib/curriculum/material-profile';
import { includesLiveClass } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'The Word document could not be read. Choose the file again and retry.' }, { status: 400 });
  }
  const value = formData.get('file');
  if (!(value instanceof File) || value.size <= 0) return NextResponse.json({ error: 'Choose a non-empty lecture file.' }, { status: 400 });
  if (value.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Lecture files must be 20 MB or smaller.' }, { status: 413 });
  if (!isSupportedLectureFile(value.name, value.type)) return NextResponse.json({ error: 'Use PDF, DOC, DOCX, PPTX, or TXT files. LenxiQ parses the file before class.' }, { status: 415 });

  let extractedText: string;
  try {
    const normalizedName = normalizeLectureFileName(value.name, value.type);
    const normalizedFile = new File([await value.arrayBuffer()], normalizedName, { type: normalizeLectureMimeType(normalizedName, value.type) });
    extractedText = await extractLectureText(normalizedFile);
  } catch {
    return NextResponse.json({ error: 'LenxiQ could not read this lecture file. Try a text-readable PDF, DOC, DOCX, PPTX, or TXT file.' }, { status: 422 });
  }
  if (!extractedText.trim()) return NextResponse.json({ error: 'No readable text was found. If this is a scan or image-only document, add a text-readable version or paste the key content in the focus prompt.' }, { status: 422 });

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

  const profile = detectMaterialBranches(extractedText, value.name, extractedText.length);
  return NextResponse.json({
    path: storagePath,
    signedUrl: signedData.signedUrl,
    parsed: true,
    sourceFileName: value.name,
    sourceExtension: getLectureFileExtension(value.name, value.type),
    extractedCharacterCount: extractedText.length,
    materialProfile: profile,
  });
}
