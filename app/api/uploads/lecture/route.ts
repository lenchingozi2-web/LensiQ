import { checkPaidAccess } from '@/lib/paid-access';
import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { isSupportedLectureFile, normalizeLectureMimeType } from '@/lib/curriculum/file-types';

const BUCKET = 'teaching-attachments';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_STORAGE_BYTES = 100 * 1024 * 1024;

async function readSmallJson(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(length) && length > 8 * 1024) return null;
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 8 * 1024) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch { return null; }
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'lecture-file';
}

export async function POST(request: Request) {
  const paid = await checkPaidAccess();
  if (!paid.allowed) return NextResponse.json({error:paid.message},{status:paid.status??403});

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const body = await readSmallJson(request);
  if (!body) return NextResponse.json({ error: 'Invalid lecture upload request.' }, { status: 400 });
  const scope = body?.scope === 'teaching' || body?.scope === 'search' ? body.scope : null;
  const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
  const sizeBytes = Number(body?.sizeBytes);
  if (!scope || !fileName || fileName.length > 200 || mimeType.length > 160 || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Lecture files must be between 1 byte and 20 MB.' }, { status: 413 });
  }
  if (!isSupportedLectureFile(fileName, mimeType)) return NextResponse.json({ error: 'Use a PDF, DOC, DOCX, PPTX, or plain-text lecture file.' }, { status: 415 });
  const normalizedMimeType = normalizeLectureMimeType(fileName, mimeType);

  if (scope === 'teaching') {
    const { data: usage, error: usageError } = await supabase.rpc('get_user_teaching_storage_bytes', { p_user_id: user.id });
    if (usageError) return NextResponse.json({ error: 'Unable to confirm your Teaching storage usage.' }, { status: 503 });
    if (Number(usage ?? 0) + sizeBytes > MAX_STORAGE_BYTES) return NextResponse.json({ error: 'Your persistent Teaching storage is full. Delete an older lecture file before uploading another.' }, { status: 413 });
  }

  const storagePath = `${user.id}/${scope}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data?.token) {
    console.error('Lecture signed-upload token failed:', error);
    return NextResponse.json({ error: 'Unable to prepare the lecture upload.' }, { status: 500 });
  }
  return NextResponse.json({ bucket: BUCKET, path: storagePath, token: data.token, mimeType: normalizedMimeType, sizeBytes });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const storagePath = typeof body?.storagePath === 'string' ? body.storagePath : '';
  if (storagePath.length > 600 || !storagePath.startsWith(`${user.id}/search/`)) return NextResponse.json({ error: 'Temporary search upload does not belong to your account.' }, { status: 403 });
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) return NextResponse.json({ error: 'Unable to remove the temporary search upload.' }, { status: 500 });
  return NextResponse.json({ ok: true, storagePath });
}
