import {observeAiStream,usageFromPayload} from '@/lib/ai/usage-meter';
import {recordAiUsage} from '@/lib/ai/record-usage';
import { verifyLiveClassGatewayToken } from '@/lib/voice/live-class-gateway-auth';
import { openSpokenResponse } from '@/lib/voice/open-spoken-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { after, NextResponse } from 'next/server';

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
  // Retain source fidelity and the actual visible model even in long lessons.
  const pinned = ['UPLOADED SOURCE POLICY:', 'SOURCE NOTES:', 'CURRENT INTERACTIVE VISUAL:', 'CURRENT TEACHING BOARD:', 'OPTIONAL APPROVED VISUAL', 'PRIORITY APPROVED VISUAL', 'POINTED QUESTION:', 'LESSON PROGRESS MEMORY:'].flatMap(prefix=>{const latest=systems.findLast(message=>message.content.startsWith(prefix));return latest&&!dynamic.includes(latest)&&!first.includes(latest)?[latest]:[];});
  return [...first, {role:'system', content:'SPOKEN DELIVERY: Start each response with one complete, direct sentence of at most 12 words. Preserve essential medical qualifications. Then explain one idea at a time in plain English: define unfamiliar terms, give the reason and one example before progressing. This short opening is not a summary of the whole lesson. Avoid acknowledgements or a long preamble before answering.'}, ...dynamic, ...pinned, ...conversation];
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
  // These are independent, read-only checks. Keep both gates while avoiding
  // a second serial database round trip before every spoken answer.
  const [{ data: session, error: sessionError }, { data: eligible, error: eligibilityError }] = await Promise.all([
    admin.from('live_class_sessions').select('id').eq('id', auth.session)
      .eq('user_id', auth.user).eq('room_name', auth.room).eq('status', 'active').maybeSingle(),
    admin.rpc('live_class_gateway_allowed', {p_session:auth.session,p_user:auth.user}),
  ]);
  if (sessionError || !session) {
    return NextResponse.json({ error: 'Live Class session is no longer active.' }, { status: 401 });
  }

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
  const emptyUsage = (provider: 'groq' | 'gemini', model: string) => (payload: unknown) => {
    console.warn('Live Class provider returned an empty voice response', { provider, model });
    after(() => recordAiUsage(auth.user, 'voice_mouth',
      usageFromPayload(payload, provider, model, JSON.stringify(recent).length), { outcome: 'empty' }));
  };
  if (groqKey) {
    try {
      upstream = await openSpokenResponse('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', cache: 'no-store',
        signal: request.signal,
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: groqModel, messages: recent, stream,
          ...(stream?{stream_options:{include_usage:true}}:{}),
          max_completion_tokens: maxTokens, temperature: temp,
          // Qwen instruct mode saves reasoning tokens and lowers spoken latency.
          ...(groqModel === 'qwen/qwen3.8-27b'
            ? { reasoning_effort: 'none', include_reasoning: false } : {}),
        }),
      }, { timeoutMs: 3500, stream, onEmpty: emptyUsage('groq', groqModel) });
    } catch (error) {
      console.warn('Live Class Groq connection unavailable', {
        name: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  // Gemini is a controlled continuity fallback, not the default mouth.
  // Only retry before any Groq audio/text has streamed to the learner.
  if (!upstream?.ok || !upstream.body) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
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
      upstream = await openSpokenResponse('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST', cache: 'no-store',
        signal: request.signal,
        headers: { Authorization: `Bearer ${geminiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: geminiModel, messages: recent, stream,
          ...(stream?{stream_options:{include_usage:true}}:{}),
          max_completion_tokens: maxTokens, temperature: 0.5,
        }),
      }, { timeoutMs: 6000, stream, onEmpty: emptyUsage('gemini', geminiModel) });
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
  const usedModel=provider==='groq'?groqModel:geminiModel;
  if(!stream){const data=await upstream.json();await recordAiUsage(auth.user,'voice_mouth',usageFromPayload(data,provider,usedModel,JSON.stringify(recent).length));return NextResponse.json(data);}
  // Accounting must not hold the end-of-speech signal or the next lesson turn.
  type Observation={usage:Parameters<typeof recordAiUsage>[2];hasOutput:boolean;outcome:string};
  let settleUsage!:(value:Observation)=>void;
  const usageReady=new Promise<Observation>(resolve=>{settleUsage=resolve;});
  after(async()=>{
    const {usage,hasOutput,outcome}=await usageReady;
    const recordedOutcome=outcome==='completed'?(hasOutput?'completed':'empty'):outcome;
    if(recordedOutcome==='empty') console.warn('Live Class verbalizer returned no spoken text',{provider,model:usedModel,outputTokens:usage.outputTokens,thinkingTokens:usage.thinkingTokens});
    await recordAiUsage(auth.user,'voice_mouth',usage,{outcome:recordedOutcome});
  });
  const monitored=observeAiStream(upstream.body,{provider,model:usedModel,inputCharacters:JSON.stringify(recent).length,onFinish:async(usage,hasOutput,outcome)=>{settleUsage({usage,hasOutput,outcome});}});
  return new Response(monitored, {
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

