import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

type RouteContext = { params: Promise<{ conversationId: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const { conversationId } = await params;
  const { data: conversation, error: conversationError } = await supabase
    .from('teaching_conversations')
    .select('id, course_name, title, session_type, created_at, updated_at')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: 'Teaching session not found.' }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await supabase
    .from('teaching_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(200);

  if (messagesError) return NextResponse.json({ error: 'Unable to load teaching messages.' }, { status: 500 });

  const { data: attachments, error: attachmentsError } = await supabase
    .from('teaching_attachments')
    .select('id, file_name, mime_type, size_bytes, extraction_status, extraction_error, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (attachmentsError) return NextResponse.json({ error: 'Unable to load teaching attachments.' }, { status: 500 });
  return NextResponse.json({ conversation, messages: messages ?? [], attachments: attachments ?? [] });
}
