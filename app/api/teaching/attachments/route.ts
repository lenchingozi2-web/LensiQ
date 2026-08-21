import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { extractLectureText } from '../../../../lib/curriculum/extract-text';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'text/plain',
]);

const PARSEABLE_EXTENSIONS = new Set(['pdf', 'pptx', 'docx', 'txt']);

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'attachment';
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const formData = await req.formData();
  const conversationId = String(formData.get('conversationId') || '');
  const file = formData.get('file');

  if (!conversationId || !(file instanceof File)) {
    return NextResponse.json({ error: 'A conversation and file are required.' }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Files must be between 1 byte and 20 MB.' }, { status: 413 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'This file type is not supported.' }, { status: 415 });
  }

  const { data: conversation } = await supabase
    .from('teaching_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single();
  if (!conversation) return NextResponse.json({ error: 'Teaching session not found.' }, { status: 404 });

  const storagePath = `${user.id}/${conversationId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from('teaching-attachments')
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('Teaching attachment upload failed:', uploadError);
    return NextResponse.json({ error: 'Unable to upload this attachment.' }, { status: 500 });
  }

  let extractionStatus = 'unsupported';
  let extractedText: string | null = null;
  let extractionError: string | null = null;
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  if (PARSEABLE_EXTENSIONS.has(extension)) {
    try {
      extractedText = await extractLectureText(file);
      extractionStatus = extractedText ? 'complete' : 'empty';
    } catch (error) {
      extractionStatus = 'failed';
      extractionError = error instanceof Error ? error.message.slice(0, 500) : 'Extraction failed.';
    }
  }

  const { data: attachment, error: metadataError } = await supabase
    .from('teaching_attachments')
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      extraction_status: extractionStatus,
      extracted_text: extractedText,
      extraction_error: extractionError,
      extracted_at: extractedText ? new Date().toISOString() : null,
    })
    .select('id, file_name, mime_type, size_bytes, created_at, extraction_status')
    .single();

  if (metadataError) {
    await supabase.storage.from('teaching-attachments').remove([storagePath]);
    return NextResponse.json({ error: 'Unable to save attachment metadata.' }, { status: 500 });
  }

  const { data: signedUrl } = await supabase.storage
    .from('teaching-attachments')
    .createSignedUrl(storagePath, 60 * 60);

  return NextResponse.json({ attachment, signedUrl: signedUrl?.signedUrl ?? null }, { status: 201 });
}
