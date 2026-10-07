import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractLectureText } from '@/lib/curriculum/extract-text';

const STORAGE_BUCKET = 'teaching-attachments';
const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_STORAGE_BYTES = 100 * 1024 * 1024;

type UploadedDocument = {
  attachmentId: string;
  fileName: string;
  storagePath: string;
  extractionStatus: 'complete' | 'empty' | 'failed';
  chunkingStatus: 'pending';
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'lecture.pdf';
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const formData = await request.formData();
  const files = formData.getAll('files').filter((value): value is File => value instanceof File);
  const courseName = typeof formData.get('courseName') === 'string'
    ? String(formData.get('courseName')).trim().slice(0, 120)
    : 'Library';
  const requestedConversationId = typeof formData.get('conversationId') === 'string'
    ? String(formData.get('conversationId')).trim()
    : '';

  if (files.length === 0) return NextResponse.json({ error: 'At least one PDF is required.' }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `A batch can contain at most ${MAX_FILES} PDFs.` }, { status: 413 });

  const invalidFile = files.find((file) => !isPdf(file) || file.size <= 0 || file.size > MAX_FILE_SIZE);
  if (invalidFile) {
    return NextResponse.json({
      error: `${invalidFile.name} is invalid. Upload non-empty PDF files up to 20 MB each.`,
    }, { status: 413 });
  }

  let conversationId = requestedConversationId;
  if (conversationId) {
    const { data: conversation } = await supabase
      .from('teaching_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();
    if (!conversation) return NextResponse.json({ error: 'The requested Library session was not found.' }, { status: 404 });
  } else {
    const { data: conversation, error } = await supabase
      .from('teaching_conversations')
      .insert({
        user_id: user.id,
        course_name: courseName || 'Library',
        title: `Lecture batch · ${new Date().toLocaleDateString('en-CA')}`,
      })
      .select('id')
      .single();
    if (error || !conversation) {
      console.error('Library batch conversation creation failed:', error);
      return NextResponse.json({ error: 'Unable to prepare a Library document session.' }, { status: 500 });
    }
    conversationId = conversation.id;
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const { data: currentUsage, error: usageError } = await supabase.rpc('get_user_teaching_storage_bytes', { p_user_id: user.id });
  if (usageError) return NextResponse.json({ error: 'Unable to confirm your document storage usage.' }, { status: 503 });
  if (Number(currentUsage ?? 0) + totalBytes > MAX_STORAGE_BYTES) {
    return NextResponse.json({ error: 'Your document storage limit would be exceeded by this batch.' }, { status: 413 });
  }

  const uploaded: UploadedDocument[] = [];
  const failures: Array<{ fileName: string; error: string }> = [];

  for (const file of files) {
    const storagePath = `${user.id}/library/${conversationId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw new Error('Unable to upload the PDF.');

      let extractedText: string | null = null;
      let extractionStatus: 'complete' | 'empty' | 'failed' = 'failed';
      let extractionError: string | null = null;
      try {
        extractedText = await extractLectureText(file);
        extractionStatus = extractedText.trim() ? 'complete' : 'empty';
        if (!extractedText.trim()) extractionError = 'No readable text was found in this PDF.';
      } catch (error) {
        extractionError = error instanceof Error ? error.message.slice(0, 500) : 'PDF extraction failed.';
      }

      const { data: attachment, error: metadataError } = await supabase
        .from('teaching_attachments')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: 'application/pdf',
          size_bytes: file.size,
          extraction_status: extractionStatus,
          extracted_text: extractedText,
          extraction_error: extractionError,
          extracted_at: extractedText ? new Date().toISOString() : null,
        })
        .select('id')
        .single();
      if (metadataError || !attachment) throw new Error('Unable to save PDF metadata.');

      uploaded.push({
        attachmentId: attachment.id,
        fileName: file.name,
        storagePath,
        extractionStatus,
        chunkingStatus: 'pending',
      });
    } catch (error) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      failures.push({
        fileName: file.name,
        error: error instanceof Error ? error.message : 'Document upload failed.',
      });
    }
  }

  return NextResponse.json({
    conversationId,
    bucket: STORAGE_BUCKET,
    documents: uploaded,
    failures,
    chunking: {
      status: 'pending',
      message: 'PDFs are stored and extracted. Vector chunking and embedding generation are not started yet.',
    },
  }, { status: failures.length > 0 ? 207 : 202 });
}
