import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to use voice typing.' }, { status: 401 });

  const formData = await request.formData();
  const audio = formData.get('audio');
  if (!(audio instanceof File)) return NextResponse.json({ error: 'No audio recording was provided.' }, { status: 400 });
  if (audio.size === 0) return NextResponse.json({ error: 'The recording was empty. Hold the microphone and speak before stopping.' }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: 'The recording is too large. Keep voice questions under 60 seconds.' }, { status: 413 });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Voice transcription is not configured on this deployment.' }, { status: 503 });

  const contentType = audio.type || 'audio/webm';
  const query = new URLSearchParams({
    model: 'nova-3',
    language: 'en',
    smart_format: 'true',
    punctuate: 'true',
  });

  const response = await fetch(`https://api.deepgram.com/v1/listen?${query.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': contentType,
    },
    body: await audio.arrayBuffer(),
  });

  if (!response.ok) {
    console.error('Deepgram transcription failed:', response.status, await response.text());
    return NextResponse.json({ error: 'Voice transcription failed. Try speaking again or type your question.' }, { status: 502 });
  }

  const data = await response.json();
  const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
  if (!text) return NextResponse.json({ error: 'No speech was detected. Hold the microphone closer and try again.' }, { status: 422 });
  return NextResponse.json({ text });
}
