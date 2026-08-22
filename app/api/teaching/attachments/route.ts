import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { extractLectureText } from '../../../../lib/curriculum/extract-text';

const STORAGE_BUCKET = 'teaching-attachments';
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const PARSEABLE_EXTENSIONS = new Set(['pdf', 'pptx', 'docx', 'txt']);

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'attachment';
}

function isSupported(fileName: string, mimeType: string) {
  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  return ALLOWED_TYPES.has(mimeType) || PARSEABLE_EXTENSIONS.has(extension);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  let conversationId = '';
  let fileName = '';
  let mimeType = '';
  let sizeBytes = 0;
  let storagePath = '';
  let file: File | null = null;

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    conversationId = typeof body?.conversationId === 'string' ? body.conversationId : '';
    storagePath = typeof body?.storagePath === 'string' ? body.storagePath : '';
    fileName = typeof body?.fileName === 'string' ? body.fileName : '';
    mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
    sizeBytes = Number(body?.sizeBytes);
  } else {
    const formData = await req.formData();
    conversationId = String(formData.get('conversationId') || '');
    const fileValue = formData.get('file');
    file = fileValue instanceof File ? fileValue : null;
    if (file) { fileName = file.name; mimeType = file.type; sizeBytes = file.size; }
  }

  if (!conversationId || (!file && !storagePath)) return NextResponse.json({ error: 'A conversation and lecture file are required.' }, { status: 400 });
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE) return NextResponse.json({ error: 'Lecture files must be between 1 byte and 100 MB.' }, { status: 413 });
  if (!fileName || !isSupported(fileName, mimeType)) return NextResponse.json({ error: 'Use a PDF, PPTX, DOCX, or plain-text lecture file.' }, { status: 415 });

  const { data: conversation } = await supabase
    .from('teaching_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single();
  if (!conversation) return NextResponse.json({ error: 'Teaching session not found.' }, { status: 404 });

  if (storagePath) {
    if (!storagePath.startsWith(`${user.id}/teaching/`)) return NextResponse.json({ error: 'This lecture upload does not belong to your account.' }, { status: 403 });
    const { data: blob, error: downloadError } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath);
    if (downloadError || !blob) return NextResponse.json({ error: 'The uploaded lecture could not be retrieved. Please upload it again.' }, { status: 400 });
    if (blob.size <= 0 || blob.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'The uploaded lecture is outside the supported size range.' }, { status: 413 });
    file = new File([await blob.arrayBuffer()], fileName, { type: mimeType });
  }

  if (!file) return NextResponse.json({ error: 'The lecture file could not be read.' }, { status: 400 });

  let extractionStatus = 'failed';
  let extractedText: string | null = null;
  let extractionError: string | null = null;
  try {
    extractedText = await extractLectureText(file);
    extractionStatus = extractedText.trim() ? 'complete' : 'empty';
    if (!extractedText.trim()) extractionError = 'No readable text was found in this file.';
  } catch (error) {
    extractionError = error instanceof Error ? error.message.slice(0, 500) : 'Extraction failed.';
  }

  const finalStoragePath = storagePath || `${user.id}/teaching/${conversationId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  if (!storagePath) {
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(finalStoragePath, file, { contentType: mimeType || 'application/octet-stream', upsert: false });
    if (uploadError) {
      console.error('Teaching attachment upload failed:', uploadError);
      return NextResponse.json({ error: 'Unable to upload this attachment.' }, { status: 500 });
    }
  }

  const { data: attachment, error: metadataError } = await supabase
    .from('teaching_attachments')
    .insert({ conversation_id: conversationId, user_id: user.id, file_name: fileName, storage_path: finalStoragePath, mime_type: mimeType, size_bytes: file.size, extraction_status: extractionStatus, extracted_text: extractedText, extraction_error: extractionError, extracted_at: extractedText ? new Date().toISOString() : null })
    .select('id, file_name, mime_type, size_bytes, created_at, extraction_status, extraction_error')
    .single();

  if (metadataError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([finalStoragePath]);
    return NextResponse.json({ error: 'Unable to save attachment metadata.' }, { status: 500 });
  }

  const { data: signedUrl } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(finalStoragePath, 60 * 60);
  return NextResponse.json({ attachment, signedUrl: signedUrl?.signedUrl ?? null }, { status: 201 });
}
