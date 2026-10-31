import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Storyboard generation is available, but no authenticated video-rendering
// worker is attached to the medical platform. Do not mark projects "rendering"
// when no renderer will ever pick them up.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  return NextResponse.json({
    error: 'Video rendering is not configured yet. Your storyboard remains saved and editable.',
    code: 'renderer_unavailable',
  }, { status: 503 });
}
