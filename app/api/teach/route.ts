import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { checkAccess } from '../../../lib/gatekeeper';
import { includesLiveClass } from '../../../lib/plans';
import { getOrCreateProfile } from '../../../lib/profile';
import { buildTeachingContext } from '../../../lib/ai/teaching-context';
import { buildTeachingSystemPrompt } from '../../../lib/ai/teaching-prompt';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to use Teaching Mode.' }, { status: 401 });
    }
    const userId = user.id;

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 128 * 1024) {
      return NextResponse.json({ error: 'Teaching request is too large.' }, { status: 413 });
    }
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 128 * 1024) {
      return NextResponse.json({ error: 'Teaching request is too large.' }, { status: 413 });
    }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'Invalid teaching request.' }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 });
    }
    const rawCourseName = body.courseName;
    const rawConversationId = body.conversationId;
    const rawLiveClassSessionId = body.liveClassSessionId;
    if (
      (rawCourseName !== undefined && typeof rawCourseName !== 'string') ||
      (rawConversationId !== undefined && typeof rawConversationId !== 'string') ||
      (rawLiveClassSessionId !== undefined && typeof rawLiveClassSessionId !== 'string')
    ) {
      return NextResponse.json({ error: 'Invalid teaching request.' }, { status: 400 });
    }
    const courseName: string = String(rawCourseName ?? 'Pharmacology').slice(0, 120);
    const conversationId: string = String(rawConversationId ?? '').slice(0, 128);
    const sessionType = body.sessionType === 'live_class' ? 'live_class' : 'teaching_room';
    const liveClassSessionId: string = String(rawLiveClassSessionId ?? '').slice(0, 128);

    if (conversationId) {
      const { data: conversation } = await supabase
        .from('teaching_conversations')
        .select('id, session_type')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!conversation) return NextResponse.json({ error: 'Teaching session not found.' }, { status: 404 });
      if (sessionType === 'live_class' && conversation?.session_type !== 'live_class') {
        return NextResponse.json({ error: 'This conversation is not a Live Class session.' }, { status: 400 });
      }
    }

    const rawMessagesValue = body.messages;
    const rawMessages: unknown[] = Array.isArray(rawMessagesValue) ? rawMessagesValue as unknown[] : [];
    if (
      !Array.isArray(rawMessagesValue) ||
      rawMessages.length === 0 ||
      rawMessages.length > 20 ||
      rawMessages.some((message: unknown) => {
        if (!message || typeof message !== 'object') return true;
        const candidate = message as Record<string, unknown>;
        return (candidate.role !== 'user' && candidate.role !== 'assistant')
          || typeof candidate.content !== 'string';
      })
    ) {
      return NextResponse.json({ error: 'Invalid teaching conversation.' }, { status: 400 });
    }
    const messages = rawMessages as ChatMessage[];
    if (
      messages.some((message) => message.content.length > 6000) ||
      messages.reduce((total, message) => total + message.content.length, 0) > 30000
    ) {
      return NextResponse.json({ error: 'Invalid teaching conversation.' }, { status: 400 });
    }

    if (sessionType === 'live_class') {
      if (!liveClassSessionId) return NextResponse.json({ error: 'Live Class session is required.' }, { status: 400 });
      const { data: liveSession } = await supabase
        .from('live_class_sessions')
        .select('id, status, started_at, is_free_trial')
        .eq('id', liveClassSessionId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (!liveSession) return NextResponse.json({ error: 'The Live Class session has ended. Start a new session to continue.' }, { status: 403 });

      const { data: profile, error: profileError } = await getOrCreateProfile(supabase, user!);
      if (profileError || !profile) return NextResponse.json({ error: 'Your account profile could not be loaded.' }, { status: 503 });
      const isAdmin = profile.role === 'admin';
      const hasLiveClassPlan = includesLiveClass(profile.plan)
        && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date());
      const isFreeTrial = liveSession?.is_free_trial === true;
      if (!isAdmin && (!hasLiveClassPlan || isFreeTrial)) {
        await supabase.from('live_class_sessions').update({ status: 'expired', ended_at: new Date().toISOString() }).eq('id', liveClassSessionId).eq('user_id', userId);
        return NextResponse.json({ error: 'Live Class is available only with an active All Access plan.' }, { status: 403 });
      }
      if (!isAdmin) {
        const { data: chargeRows, error: chargeError } = await supabase.rpc('charge_live_class_session', {
          p_session_id: liveClassSessionId,
          p_duration_seconds: Math.max(0, Math.floor((Date.now() - new Date(liveSession!.started_at).getTime()) / 1000)),
          p_end: false,
        });
        const charge = Array.isArray(chargeRows) ? chargeRows[0] : chargeRows;
        if (chargeError || !charge?.ok) return NextResponse.json({ error: 'Unable to confirm the remaining Live Class wallet balance.' }, { status: 503 });
        if (charge.should_end) return NextResponse.json({ error: charge.reason === 'free_monthly_exhausted' ? 'Your free Live Class allowance has ended for this month. It refreshes next month.' : 'Your Premium Live Class allowance has ended. Minutes refresh on your next monthly billing date.' }, { status: 403 });
      }
    } else if (messages.length === 1) {
      const access = await checkAccess('teaching');
      if (!access.allowed) {
        return NextResponse.json({ error: access.message }, { status: access.status });
      }
    }

    const context = await buildTeachingContext(supabase, courseName, messages, conversationId || undefined);
    const systemPrompt = buildTeachingSystemPrompt(courseName, context, sessionType === 'live_class');

    // Gemini-only tutor: use a second Gemini Flash model when the primary is overloaded.
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    if (!geminiKey) {
      return NextResponse.json({ error: 'The AI tutor is not configured. Please contact support.' }, { status: 503 });
    }

    const primaryModel = (process.env.GEMINI_TEACHING_MODEL || 'gemini-3.8-flash').replace(/^models\//, '');
    const fallbackModel = (process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.6-flash').replace(/^models\//, '');
    const models = [...new Set([primaryModel, fallbackModel])];
    if (models.some((name) => !/^[a-zA-Z0-9._-]{1,80}$/.test(name))) {
      return NextResponse.json({ error: 'The AI tutor model is misconfigured.' }, { status: 503 });
    }

    const contents = messages.map(({ role, content }) => ({
      role: role === 'assistant' ? 'model' : 'user',
      parts: [{ text: content }],
    }));
    const providerBody = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'LOW' } },
    });

    let providerResponse: Response | null = null;
    let lastStatus: number | null = null;
    const retryable = new Set([429, 500, 502, 503, 504]);
    // Keep retries and fallback inside the serverless function's execution window.
    const deadline = Date.now() + 45_000;
    providerLoop:
    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      const model = models[modelIndex];
      const attempts = modelIndex === 0 ? 2 : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const remainingMs = deadline - Date.now();
        if (remainingMs < 3500) break providerLoop;
        try {
          const candidate = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
            method: 'POST',
            signal: AbortSignal.timeout(Math.min(20_000, remainingMs - 1000)),
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
            body: providerBody,
          });
          if (candidate.ok && candidate.body) {
            providerResponse = candidate;
            break providerLoop;
          }
          lastStatus = candidate.status;
          console.error('Teaching Gemini provider unavailable', { status: candidate.status, model, attempt: attempt + 1 });
          await candidate.body?.cancel().catch(() => undefined);
          if (!retryable.has(candidate.status)) break providerLoop;
        } catch (error) {
          console.error('Teaching Gemini transport failure', {
            model,
            name: error instanceof Error ? error.name : 'unknown',
          });
        }
        if (attempt + 1 < attempts && deadline - Date.now() > 4000) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
      }
    }

    if (!providerResponse?.body) {
      return NextResponse.json({
        error: lastStatus === 429
          ? 'The AI tutor is busy. Please try again shortly.'
          : 'The AI tutor is temporarily unavailable. Please try again.',
      }, { status: lastStatus === 429 ? 429 : 503 });
    }
    return new Response(providerResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'unknown_error';
    console.error('AI Teaching Error:', errorName);
    const timedOut = errorName === 'TimeoutError' || errorName === 'AbortError';
    return NextResponse.json(
      { error: timedOut ? 'The AI provider took too long to reply. Please try again.' : 'The AI Tutor is temporarily unavailable. Please try again.' },
      { status: timedOut ? 504 : 500 },
    );
  }
}
