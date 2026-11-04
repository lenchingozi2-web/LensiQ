import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * A private OpenAI-compatible gateway for the LiveKit Cloud Pipecat worker.
 *
 * LiveKit Cloud injects the project credentials into its deployed agent.
 * This route and that agent derive the same scoped bearer credential from
 * LIVEKIT_API_SECRET. No Gemini key is copied into LiveKit, GitHub, or clients.
 */
export async function POST(request: Request) {
  const liveKitSecret = process.env.LIVEKIT_API_SECRET?.trim() || '';
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!liveKitSecret || !geminiKey) {
    return NextResponse.json({ error: 'Voice model is not configured.' }, { status: 503 });
  }

  const expected = createHmac('sha256', liveKitSecret)
    .update('lenxiq-live-class-llm-proxy-v1').digest('hex');
  const auth = request.headers.get('authorization') || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!/^[a-f0-9]{64}$/.test(provided) ||
      !timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const lengthHeader = Number(request.headers.get('content-length') || 0);
  if (!Number.isFinite(lengthHeader) || lengthHeader > 240_000) {
    return NextResponse.json({ error: 'Voice request is too large.' }, { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 240_000) {
    return NextResponse.json({ error: 'Voice request is too large.' }, { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    payload = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid voice request.' }, { status: 400 });
  }

  const rawMessages = payload.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > 100) {
    return NextResponse.json({ error: 'Invalid voice messages.' }, { status: 400 });
  }
  const messages = rawMessages.filter((entry): entry is { role: string; content: string } =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry) &&
    ['system', 'user', 'assistant'].includes((entry as { role?: unknown }).role as string) &&
    typeof (entry as { content?: unknown }).content === 'string'
  ).map((entry) => ({ role: entry.role, content: entry.content.slice(0, 10000) }));

  if (messages.length !== rawMessages.length) {
    return NextResponse.json({ error: 'Invalid message format.' }, { status: 400 });
  }
  const recent = messages.length > 20
    ? [...messages.filter((m) => m.role === 'system').slice(0, 1), ...messages.slice(-19)]
    : messages;
  if (recent.reduce((sum, m) => sum + m.content.length, 0) > 95_000) {
    return NextResponse.json({ error: 'Voice context is too large.' }, { status: 413 });
  }

  const requestedLimit = Number(payload.max_completion_tokens ?? payload.max_tokens ?? 1400);
  const maxTokens = Number.isFinite(requestedLimit)
    ? Math.max(100, Math.min(2200, Math.floor(requestedLimit))) : 1400;
  const model = process.env.GEMINI_CLASS_VERBALIZER_MODEL?.trim() || 'gemini-3.8-flash';
  if (!/^gemini-[a-z0-9.-]+$/.test(model)) {
    return NextResponse.json({ error: 'Invalid model configuration.' }, { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      signal: request.signal,
      headers: { Authorization: `Bearer ${geminiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: recent,
        stream: payload.stream !== false,
        max_completion_tokens: maxTokens,
        temperature: 0.5,
      }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Voice model connection failed.' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({
      error: upstream.status === 429 ? 'Voice model quota reached.' : 'Voice model unavailable.',
    }, { status: upstream.status === 429 ? 429 : 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
