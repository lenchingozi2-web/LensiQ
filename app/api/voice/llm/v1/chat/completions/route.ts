import { verifyLiveClassGatewayToken } from '@/lib/voice/live-class-gateway-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type VoiceMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Preserve the active lecture evidence and progress ledger before trimming
 * dialogue. The worker keeps the six full sources; this request carries only
 * the excerpts that matter to the current answer.
 */
export function selectVoiceContext(messages: VoiceMessage[]): VoiceMessage[] {
  const systems = messages.filter((message) => message.role === 'system');
  const first = systems.slice(0, 1);
  const dynamic = systems.slice(1).slice(-6);
  const conversation = messages.filter((message) => message.role !== 'system').slice(-14);
  return [...first, ...dynamic, ...conversation];
}

/** Private, session-scoped OpenAI-compatible gateway.
 * Gemini plans the lesson separately; Groq verbalizes at low latency.
 * Kokoro remains the only speech synthesizer. Provider keys never reach
 * LiveKit, the browser, or the Git repository.
 */
export async function POST(request: Request) {
  const liveKitSecret = process.env.LIVEKIT_API_SECRET?.trim() || '';
  const groqKey = process.env.GROQ_API_KEY?.trim() || '';
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!liveKitSecret || (!groqKey && !geminiKey)) {
    return NextResponse.json({ error: 'Live Class verbalizer is not configured.' }, { status: 503 });
  }
  const auth = verifyLiveClassGatewayToken(
    liveKitSecret, request.headers.get('authorization'),
  );
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: 'Class service unavailable.' }, { status: 503 });
  const { data: session, error: sessionError } = await admin.from('live_class_sessions')
    .select('id').eq('id', auth.session).eq('user_id', auth.user)
    .eq('room_name', auth.room).eq('status', 'active').maybeSingle();
  if (sessionError || !session) {
    return NextResponse.json({ error: 'Live Class session is no longer active.' }, { status: 401 });
  }

  const { data: eligible, error: eligibilityError } = await admin.rpc('live_class_gateway_allowed', {p_session:auth.session,p_user:auth.user});
  if(eligibilityError || eligible !== true) return NextResponse.json({error:'Class allowance expired.'},{status:403});

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
  if (!Array.isArray(rawMessages) || rawMessages.length < 1 || rawMessages.length > 100) {
    return NextResponse.json({ error: 'Invalid voice messages.' }, { status: 400 });
  }
  const messages: VoiceMessage[] = [];
  for (const entry of rawMessages) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return NextResponse.json({ error: 'Invalid message format.' }, { status: 400 });
    }
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if ((role !== 'system' && role !== 'user' && role !== 'assistant')
      || typeof content !== 'string' || content.length > 24_000) {
      return NextResponse.json({ error: 'Invalid message format.' }, { status: 400 });
    }
    messages.push({ role, content });
  }
  const recent = selectVoiceContext(messages);
  // The student source files are never summarized or truncated in the worker.
  // Oversized live prompts are rejected instead of silently dropping the
  // retrieved lecture evidence or per-turn progress memory.
  if (recent.reduce((sum, message) => sum + message.content.length, 0) > 95_000) {
    return NextResponse.json({ error: 'Current voice context is too large.' }, { status: 413 });
  }

  const requestedLimit = Number(payload.max_completion_tokens ?? payload.max_tokens ?? 900);
  const maxTokens = Number.isFinite(requestedLimit)
    ? Math.max(180, Math.min(1300, Math.floor(requestedLimit))) : 900;
  const groqModel = process.env.GROQ_CLASS_MOUTH_MODEL?.trim() || 'qwen/qwen3.8-27b';
  const geminiModel = process.env.GEMINI_CLASS_VERBALIZER_MODEL?.trim() || 'gemini-3.8-flash';
  if (!/^(?:qwen\/qwen3\.8-27b|openai\/gpt-oss-20b|openai\/gpt-oss-120b)$/.test(groqModel)
    || !/^gemini-[a-z0-9.-]+$/.test(geminiModel)) {
    return NextResponse.json({ error: 'Invalid voice model configuration.' }, { status: 503 });
  }

  const stream = payload.stream !== false;
  const temp = 0.62;
  let upstream: Response | null = null;
  let provider: 'groq' | 'gemini' = 'groq';
  if (groqKey) {
    try {
      upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', cache: 'no-store',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(19000)]),
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: groqModel, messages: recent, stream,
          max_completion_tokens: maxTokens, temperature: temp,
          // Qwen instruct mode saves reasoning tokens and lowers spoken latency.
          ...(groqModel === 'qwen/qwen3.8-27b'
            ? { reasoning_effort: 'none', include_reasoning: false } : {}),
        }),
      });
    } catch (error) {
      console.warn('Live Class Groq connection unavailable', {
        name: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  // Gemini is a controlled continuity fallback, not the default mouth.
  // Only retry before any Groq audio/text has streamed to the learner.
  if (!upstream?.ok || !upstream.body) {
    if (upstream) {
      console.warn('Live Class Groq verbalizer rejected request', { status: upstream.status });
      await upstream.body?.cancel().catch(() => undefined);
    }
    if (!geminiKey) {
      return NextResponse.json({ error: 'Groq unavailable; Gemini fallback not configured.' },
        { status: upstream?.status === 429 ? 429 : 503 });
    }
    provider = 'gemini';
    try {
      upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST', cache: 'no-store',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(27000)]),
        headers: { Authorization: `Bearer ${geminiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: geminiModel, messages: recent, stream,
          max_completion_tokens: maxTokens, temperature: 0.5,
        }),
      });
    } catch {
      return NextResponse.json({ error: 'Both voice models are unavailable.' }, { status: 502 });
    }
  }

  if (!upstream.ok || !upstream.body) {
    console.warn('Live Class fallback unavailable', { status: upstream.status });
    return NextResponse.json({
      error: upstream.status === 429 ? 'Voice model quota reached.' : 'Voice model unavailable.',
    }, { status: upstream.status === 429 ? 429 : 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ||
        (stream ? 'text/event-stream; charset=utf-8' : 'application/json'),
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
      'X-LenxiQ-Verbalizer': provider,
    },
  });
}
