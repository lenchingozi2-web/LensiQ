import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

type RouteContext = { params: Promise<{ conversationId: string }> };

async function getOwnedConversation(conversationId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('teaching_conversations')
    .select('id, course_name, title, session_type, is_pinned, created_at, updated_at')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();
  return { supabase, data, error };
}

export async function GET(_req: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const { conversationId } = await params;
  const { data: conversation, error: conversationError } = await getOwnedConversation(conversationId, user.id);

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

export async function PATCH(req: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const { conversationId } = await params;
  const body = await req.json().catch(() => ({}));
  if (body?.action !== 'pin' && body?.action !== 'unpin') return NextResponse.json({ error: 'A pin action is required.' }, { status: 400 });

  const { data, error } = await supabase
    .from('teaching_conversations')
    .update({ is_pinned: body.action === 'pin' })
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select('id, course_name, title, session_type, is_pinned, created_at, updated_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Teaching session not found.' }, { status: 404 });
  return NextResponse.json({ conversation: data });
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const { conversationId } = await params;
  const { error } = await supabase
    .from('teaching_conversations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: 'Unable to delete teaching session.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
