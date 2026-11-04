import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyLiveClassGatewayToken } from '@/lib/voice/live-class-gateway-auth';
import { getLiveClassStorageModels } from '@/lib/voice/live-class-storage-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const responseHeaders = { 'Cache-Control': 'private, no-store' };
async function inventoryResponse() {
  try {
    const inventory = await getLiveClassStorageModels();
    return NextResponse.json(inventory, { headers: responseHeaders });
  } catch (error) {
    console.error('Live Class model catalogue could not load:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({
      error: 'Medical-models storage catalogue unavailable; existing verified visuals remain as a fallback.',
    }, { status: 503, headers: responseHeaders });
  }
}

/** Browser: session-validated public-bucket catalogue, with no service keys. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to see the medical model library.' }, { status: 401 });
  return inventoryResponse();
}

/** Voice worker: only a server-issued, active-room, expiring classroom token. */
export async function POST(request: Request) {
  const secret = process.env.LIVEKIT_API_SECRET?.trim() || '';
  const auth = secret && verifyLiveClassGatewayToken(secret, request.headers.get('authorization'));
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Class service unavailable.' }, { status: 503 });
  const { data: session, error } = await admin.from('live_class_sessions')
    .select('id')
    .eq('id', auth.session)
    .eq('user_id', auth.user)
    .eq('room_name', auth.room)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !session) {
    return NextResponse.json({ error: 'Active Live Class required.' }, { status: 401 });
  }
  return inventoryResponse();
}
