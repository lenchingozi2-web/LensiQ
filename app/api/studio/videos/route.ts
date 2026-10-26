import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    const { data: videos, error } = await supabase.from('videos').select('id,title,description,bgm_query,scenes,status,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (error) return NextResponse.json({ error: 'Video queue is unavailable. Apply the Studio migration first.' }, { status: 503 });
    return NextResponse.json({ videos: videos ?? [] });
  } catch (error) {
    console.error('Studio queue error', error);
    return NextResponse.json({ error: 'Unable to load the video queue.' }, { status: 500 });
  }
}
