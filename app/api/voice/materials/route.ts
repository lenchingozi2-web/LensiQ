import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractLectureText } from '@/lib/curriculum/extract-text';
import { isLegacyWordDocument, normalizeLectureFileName, normalizeLectureMimeType } from '@/lib/curriculum/file-types';

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'The Word document could not be read. Choose the file again and retry.' }, { status: 400 });
  }
  const value = formData.get('file');
  if (!(value instanceof File) || value.size <= 0) return NextResponse.json({ error: 'Choose a non-empty Word document.' }, { status: 400 });
  if (value.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Legacy DOC files must be 20 MB or smaller.' }, { status: 413 });
  if (!isLegacyWordDocument(value.name, value.type)) return NextResponse.json({ error: 'This conversion route accepts legacy Word DOC files only.' }, { status: 415 });

  let extractedText: string;
  try {
    const normalizedName = normalizeLectureFileName(value.name, value.type);
    const normalizedFile = new File([await value.arrayBuffer()], normalizedName, { type: normalizeLectureMimeType(normalizedName, value.type) });
    extractedText = await extractLectureText(normalizedFile);
  } catch {
    return NextResponse.json({ error: 'LenxiQ could not read this Word file. Try saving it as DOCX or exporting it as PDF.' }, { status: 422 });
  }
  if (!extractedText.trim()) return NextResponse.json({ error: 'No readable text was found in this Word file. Try saving it as DOCX or exporting it as a text-based PDF.' }, { status: 422 });

  const outputName = `${safeBaseName(value.name)}.doc.txt`;
  const storagePath = `${user.id}/class_${crypto.randomUUID()}/${outputName}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, Buffer.from(extractedText, 'utf8'), { contentType: 'text/plain; charset=utf-8', upsert: false });
  if (uploadError) {
    console.error('Live Class DOC extraction upload failed:', uploadError);
    return NextResponse.json({ error: 'The extracted lecture text could not be saved for this class. Please try again.' }, { status: 500 });
  }

  const { data: signedData, error: signedError } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (signedError || !signedData?.signedUrl) {
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: 'The tutor could not be given temporary access to this lecture file. Please retry.' }, { status: 500 });
  }

  return NextResponse.json({ path: storagePath, signedUrl: signedData.signedUrl, converted: true, extractedCharacterCount: extractedText.length });
}
