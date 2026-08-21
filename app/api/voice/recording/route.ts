import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

const MAX_RECORDING_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/wav']);

function safeMimeType(value: string) {
  return ALLOWED_TYPES.has(value) ? value : 'audio/webm';
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const formData = await req.formData();
  const conversationId = String(formData.get('conversationId') || '').trim();
  const file = formData.get('file');
  if (!conversationId || !(file instanceof File)) return NextResponse.json({ error: 'A Live Class conversation and audio file are required.' }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_RECORDING_SIZE) return NextResponse.json({ error: 'The recording must be between 1 byte and 50 MB.' }, { status: 413 });

  const { data: conversation } = await supabase
    .from('teaching_conversations')
    .select('id, session_type, recording_path')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .eq('session_type', 'live_class')
    .is('deleted_at', null)
    .single();
  if (!conversation) return NextResponse.json({ error: 'Live Class session not found.' }, { status: 404 });

  const contentType = safeMimeType(file.type);
  const extension = contentType.includes('mp4') ? 'm4a' : contentType.includes('ogg') ? 'ogg' : contentType.includes('wav') ? 'wav' : 'webm';
  const storagePath = `${user.id}/${conversationId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('live-class-recordings')
    .upload(storagePath, file, { contentType, upsert: false });
  if (uploadError) {
    console.error('Live Class recording upload failed:', uploadError);
    return NextResponse.json({ error: 'Unable to save the Live Class recording.' }, { status: 500 });
  }

  if (conversation.recording_path) await supabase.storage.from('live-class-recordings').remove([conversation.recording_path]);
  const { error: updateError } = await supabase
    .from('teaching_conversations')
    .update({ recording_path: storagePath, recording_mime_type: contentType, recording_size_bytes: file.size, recording_created_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', user.id);
  if (updateError) {
    await supabase.storage.from('live-class-recordings').remove([storagePath]);
    return NextResponse.json({ error: 'Unable to attach the recording to History.' }, { status: 500 });
  }

  const { data: signedUrl } = await supabase.storage.from('live-class-recordings').createSignedUrl(storagePath, 60 * 60 * 24 * 30);
  return NextResponse.json({ ok: true, recording: { mimeType: contentType, sizeBytes: file.size, signedUrl: signedUrl?.signedUrl ?? null } });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const conversationId = new URL(req.url).searchParams.get('conversationId')?.trim() || '';
  if (!conversationId) return NextResponse.json({ error: 'Conversation is required.' }, { status: 400 });

  const { data: conversation } = await supabase
    .from('teaching_conversations')
    .select('recording_path, recording_mime_type, recording_size_bytes, recording_created_at')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .eq('session_type', 'live_class')
    .is('deleted_at', null)
    .single();
  if (!conversation?.recording_path) return NextResponse.json({ recording: null });
  const { data: signedUrl, error } = await supabase.storage.from('live-class-recordings').createSignedUrl(conversation.recording_path, 60 * 60);
  if (error || !signedUrl?.signedUrl) return NextResponse.json({ error: 'Unable to open the saved recording.' }, { status: 500 });
  return NextResponse.json({ recording: { signedUrl: signedUrl.signedUrl, mimeType: conversation.recording_mime_type, sizeBytes: conversation.recording_size_bytes, createdAt: conversation.recording_created_at } });
}
