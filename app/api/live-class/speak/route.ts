import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chunkMedicalSpeech } from '@/lib/voice/medical-speech';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const VOICES: Record<string, string> = {
  'max_hours:male': 'aura-orpheus-en', 'max_hours:female': 'aura-athena-en',
  'studio_clarity:male': 'aura-2-orpheus-en', 'studio_clarity:female': 'aura-2-athena-en',
  orpheus: 'aura-orpheus-en', athena: 'aura-athena-en', draco: 'aura-2-draco-en',
};
export async function GET() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to check Live Class audio.' }, { status: 401 });
  return NextResponse.json({ transport: 'direct-deepgram', deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY), groqConfigured: Boolean(process.env.GROQ_API_KEY) }, { headers: { 'cache-control': 'private, no-store' } });
}
export async function POST(request: Request) {
  try {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to use Live Class audio.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text : '';
  const mode = body?.mode === 'studio_clarity' ? 'studio_clarity' : 'max_hours';
  const requested = typeof body?.voiceModel === 'string' ? body.voiceModel : '';
  const voice = VOICES[requested] || VOICES[`${mode}:male`];
  const chunks = chunkMedicalSpeech(text);
  const normalized = chunks.join(' ').trim();
  if (!normalized) return NextResponse.json({ error: 'Spoken text is required.' }, { status: 400 });
  if (normalized.length > 1800) return NextResponse.json({ error: 'This spoken passage is too long. Please send a shorter beat.' }, { status: 413 });
  const key = process.env.DEEPGRAM_API_KEY?.trim();
  if (!key) { console.error('DEEPGRAM_API_KEY missing on server'); return NextResponse.json({ error: 'DEEPGRAM_API_KEY missing on server' }, { status: 503 }); }
  const response = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}&encoding=mp3&bit_rate=32000`, {
    method: 'POST', headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: normalized }), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const message = 'Deepgram HTTP ' + response.status + (response.status === 401 ? ': check the server API key' : response.status === 400 ? ': provider rejected the audio request' : response.status === 402 ? ': check account credits' : response.status === 429 ? ': rate limited' : ': synthesis failed');
    console.error('Direct Deepgram synthesis failed', { status: response.status, requestId: response.headers.get('dg-request-id'), voice });
    return NextResponse.json({ error: message, providerStatus: response.status }, { status: response.status === 402 || response.status === 429 ? response.status : 502 });
  }
  const headers = new Headers(response.headers);
  headers.set('content-type', 'audio/mpeg');
  headers.set('cache-control', 'private, no-store');
  headers.set('dg-char-count', String(normalized.length));
  headers.delete('content-length');
  return new Response(response.body, { status: 200, headers });
  } catch (error) {
    const reason = error instanceof Error ? error.name + ': ' + error.message : 'unknown failure';
    console.error('Direct speak route failed', reason);
    return NextResponse.json({ error: 'Speak route HTTP 502: ' + reason }, { status: 502 });
  }
}
