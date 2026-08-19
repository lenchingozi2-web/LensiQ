import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : '';
  const role = body?.role === 'user' || body?.role === 'assistant' ? body.role : null;
  const content = typeof body?.content === 'string' ? body.content.trim() : '';

  if (!conversationId || !role || !content || content.length > 20000) {
    return NextResponse.json({ error: 'Invalid teaching message.' }, { status: 400 });
  }

  const { data: conversation } = await supabase
    .from('teaching_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single();

  if (!conversation) return NextResponse.json({ error: 'Teaching session not found.' }, { status: 404 });

  const { data: message, error } = await supabase
    .from('teaching_messages')
    .insert({ conversation_id: conversationId, user_id: user.id, role, content })
    .select('id, role, content, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Unable to save teaching message.' }, { status: 500 });

  await supabase
    .from('teaching_conversations')
    .update({ title: role === 'user' ? content.slice(0, 80) : undefined })
    .eq('id', conversationId)
    .eq('user_id', user.id);

  return NextResponse.json({ message }, { status: 201 });
}
