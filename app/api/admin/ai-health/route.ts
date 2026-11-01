import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles')
    .select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    services: {
      textTutor: Boolean(process.env.GEMINI_API_KEY),
      liveKit: Boolean((process.env.LIVEKIT_PUBLIC_URL || process.env.LIVEKIT_URL)
        && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
      voiceWorker: 'external',
    },
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
