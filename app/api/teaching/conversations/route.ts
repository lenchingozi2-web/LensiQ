import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

type SessionType = 'teaching_room' | 'live_class';

function normalizeSessionType(value: unknown): SessionType {
  return value === 'live_class' ? 'live_class' : 'teaching_room';
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const requestedType = new URL(req.url).searchParams.get('sessionType');
  const sessionType = requestedType === 'live_class' || requestedType === 'teaching_room' ? requestedType : null;
  let query = supabase
    .from('teaching_conversations')
    .select('id, course_name, title, session_type, is_pinned, created_at, updated_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(50);

  if (sessionType) query = query.eq('session_type', sessionType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Unable to load teaching history.' }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const courseName = typeof body?.courseName === 'string' ? body.courseName.trim() : '';
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : 'New teaching session';
  const sessionType = normalizeSessionType(body?.sessionType);

  if (!courseName) return NextResponse.json({ error: 'Course is required.' }, { status: 400 });

  const { data, error } = await supabase
    .from('teaching_conversations')
    .insert({ user_id: user.id, course_name: courseName, title, session_type: sessionType })
    .select('id, course_name, title, session_type, is_pinned, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: 'Unable to create teaching session.' }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}
