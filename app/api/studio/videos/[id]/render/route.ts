import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to render a video.' }, { status: 401 });
    const { id } = await context.params;
    const { data: video, error } = await supabase.from('videos').update({ status: 'rendering', started_at: new Date().toISOString(), error_message: null }).eq('id', id).eq('user_id', user.id).eq('status', 'pending').select('id,status,started_at').single();
    if (error || !video) return NextResponse.json({ error: 'Only a pending video can be sent to the renderer.' }, { status: 409 });
    return NextResponse.json({ video });
  } catch (error) {
    console.error('Studio render transition failed', error);
    return NextResponse.json({ error: 'Unable to start rendering.' }, { status: 500 });
  }
}
