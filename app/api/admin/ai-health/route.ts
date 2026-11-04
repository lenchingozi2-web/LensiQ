import { NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';
import { createClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Probe = { reachable: boolean; detail: string };

async function checkTutor(): Promise<Probe> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { reachable: false, detail: 'Gemini credentials are not configured.' };
  const model = (process.env.GEMINI_TEACHING_MODEL || 'gemini-3.8-flash').replace('models/', '');
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) {
    return { reachable: false, detail: 'Gemini model selection is invalid.' };
  }
  try {
    // The model metadata endpoint verifies access without generating tokens.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}`,
      {
        headers: { 'x-goog-api-key': key },
        cache: 'no-store',
        signal: AbortSignal.timeout(7000),
      },
    );
    return response.ok
      ? { reachable: true, detail: `Gemini model ${model} is accessible.` }
      : { reachable: false, detail: `Gemini model check returned HTTP ${response.status}.` };
  } catch (error) {
    return {
      reachable: false,
      detail: error instanceof Error && error.name === 'TimeoutError'
        ? 'Gemini model check timed out.'
        : 'Gemini model check could not connect.',
    };
  }
}

async function checkGroq(): Promise<Probe> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return { reachable: false, detail: 'Groq Mouth credentials are not configured.' };
  const model = process.env.GROQ_CLASS_MOUTH_MODEL?.trim() || 'qwen/qwen3.8-27b';
  try {
    // Read-only model listing, no generated tokens or per-class charges.
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      return { reachable: false, detail: `Groq model check returned HTTP ${response.status}.` };
    }
    const data = await response.json() as { data?: Array<{ id?: string }> };
    const ready = data.data?.some((item) => item.id === model) ?? false;
    return {
      reachable: ready,
      detail: ready ? `Groq ${model} is accessible. Model listing does not test speech.`
        : `Groq credentials connected, but ${model} is not available for this account.`,
    };
  } catch {
    return { reachable: false, detail: 'Groq model metadata check could not connect.' };
  }
}

async function checkLiveKit(): Promise<Probe> {
  const rawUrl = (process.env.LIVEKIT_PUBLIC_URL || process.env.LIVEKIT_URL || '').trim();
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!rawUrl || !key || !secret) {
    return { reachable: false, detail: 'LiveKit credentials or host are not configured.' };
  }
  const url = rawUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:');
  if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
    return { reachable: false, detail: 'LiveKit cloud host must use HTTPS.' };
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = new RoomServiceClient(url, key, secret);
    await Promise.race([
      client.listRooms(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('timeout')), 7000);
      }),
    ]);
    return { reachable: true, detail: 'LiveKit room service responded successfully.' };
  } catch (error) {
    return { reachable: false, detail: error instanceof Error && error.message === 'timeout'
      ? 'LiveKit room service check timed out.'
      : 'LiveKit room service did not respond successfully.' };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles')
    .select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const groqPromise = checkGroq();
  const [tutor, liveKit] = await Promise.all([checkTutor(), checkLiveKit()]);
  const groq = await groqPromise;
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    services: {
      textTutor: tutor.reachable,
      textTutorDetail: tutor.detail,
      liveKit: liveKit.reachable,
      liveKitDetail: liveKit.detail,
      groq: groq.reachable,
      groqDetail: groq.detail,
      voiceWorker: 'external',
    },
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
