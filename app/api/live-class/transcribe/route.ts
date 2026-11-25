import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to ask a classroom question.' }, { status: 401 });
  const form = await request.formData();
  const audio = form.get('audio');
  if (!(audio instanceof File) || audio.size === 0 || audio.size > 4 * 1024 * 1024 || !/^audio\/(?:webm|mp4|mpeg|wav|ogg)/i.test(audio.type)) {
    return NextResponse.json({ error: 'Record a short WebM or MP4 question under 4 MB.' }, { status: 400 });
  }
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: 'Direct question transcription is not configured.' }, { status: 503 });
  const payload = new FormData();
  payload.set('file', audio, audio.name || 'question.webm');
  payload.set('model', 'whisper-large-v3-turbo');
  payload.set('language', 'en');
  payload.set('response_format', 'json');
  payload.set('temperature', '0');
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: payload, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return NextResponse.json({ error: 'The question could not be transcribed. Please retry.' }, { status: 502 });
  const data = await response.json().catch(() => ({}));
  const transcript = typeof data.text === 'string' ? data.text.trim().slice(0, 900) : '';
  if (!transcript) return NextResponse.json({ error: 'No clear speech was detected.' }, { status: 422 });
  return NextResponse.json({ transcript });
}
