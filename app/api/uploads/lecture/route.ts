import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

const BUCKET = 'teaching-attachments';
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const PARSEABLE_EXTENSIONS = new Set(['pdf', 'pptx', 'docx', 'txt']);

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'lecture-file';
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const scope = body?.scope === 'teaching' || body?.scope === 'search' ? body.scope : null;
  const fileName = typeof body?.fileName === 'string' ? body.fileName : '';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
  const sizeBytes = Number(body?.sizeBytes);
  if (!scope || !fileName || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Files must be between 1 byte and 100 MB.' }, { status: 413 });
  }
  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  if (!ALLOWED_TYPES.has(mimeType) && !PARSEABLE_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: 'Use a PDF, PPTX, DOCX, or plain-text lecture file.' }, { status: 415 });
  }
  const normalizedMimeType = ALLOWED_TYPES.has(mimeType) ? mimeType : extension === 'pdf' ? 'application/pdf' : extension === 'txt' ? 'text/plain' : extension === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const storagePath = `${user.id}/${scope}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data?.token) {
    console.error('Lecture signed-upload token failed:', error);
    return NextResponse.json({ error: 'Unable to prepare the lecture upload.' }, { status: 500 });
  }

  return NextResponse.json({ bucket: BUCKET, path: storagePath, token: data.token, mimeType: normalizedMimeType, sizeBytes });
}
