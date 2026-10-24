import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { checkAccess } from '../../../lib/gatekeeper';
import { isPaidPlan } from '../../../lib/plans';
import { getOrCreateProfile } from '../../../lib/profile';
import { buildTeachingContext } from '../../../lib/ai/teaching-context';
import { buildTeachingSystemPrompt } from '../../../lib/ai/teaching-prompt';
import { reserveAiRequest } from '../../../lib/ai/request-budget';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to use Teaching Mode.' }, { status: 401 });
    }
    const userId = user.id;
    return NextResponse.json(
      { error: 'ai_paused', message: 'The AI Tutor is temporarily paused while service usage is reviewed.' },
      { status: 503 },
    );

    const { data: adminSettings } = await supabase
      .from('site_settings')
      .select('is_ai_tutor_enabled')
      .eq('id', 1)
      .single();

    if (adminSettings?.is_ai_tutor_enabled === false) {
      return NextResponse.json(
        { error: 'ai_paused', message: 'The AI Tutor is currently paused for maintenance. Please check back shortly.' },
        { status: 503 },
      );
    }

    const body = await req.json();
    const courseName = typeof body?.courseName === 'string' ? body.courseName : 'Pharmacology';
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : '';
    const sessionType = body?.sessionType === 'live_class' ? 'live_class' : 'teaching_room';
    const liveClassSessionId = typeof body?.liveClassSessionId === 'string' ? body.liveClassSessionId : '';

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

    const messages = Array.isArray(body?.messages)
      ? body.messages.filter(
          (message: unknown): message is ChatMessage =>
            message !== null
            && typeof message === 'object'
            && 'role' in message
            && 'content' in message
            && ((message as ChatMessage).role === 'user' || (message as ChatMessage).role === 'assistant')
            && typeof (message as ChatMessage).content === 'string',
        )
      : [];

    if (messages.length === 0 || messages.length > 20 || messages.some((message) => message.content.length > 6000)) {
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
      const isPremiumVoice = isPaidPlan(profile.plan) && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date());
      const isFreeTrial = liveSession?.is_free_trial === true;
      if (!isAdmin && !isPremiumVoice && !isFreeTrial) {
        await supabase.from('live_class_sessions').update({ status: 'expired', ended_at: new Date().toISOString() }).eq('id', liveClassSessionId).eq('user_id', userId);
        return NextResponse.json({ error: 'Your free Live Class allowance is used for this month. It refreshes next month, or you can upgrade to Hybrid Premium.' }, { status: 403 });
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

    const budget = await reserveAiRequest(supabase, 'teach');
    if (!budget.allowed) {
      return NextResponse.json(
        { error: 'ai_rate_limited', message: 'AI teaching is temporarily at capacity. Please wait a minute and try again.' },
        { status: budget.reason === 'budget_unavailable' ? 503 : 429 },
      );
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'AI provider is not configured.' }, { status: 503 });
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_TEACHING_MODEL || 'deepseek-v4-flash',
        stream: true,
        thinking: { type: 'disabled' },
        max_tokens: 1000,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`DeepSeek request failed: ${errorText}`);
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('AI Teaching Error:', error);
    return NextResponse.json(
      { error: 'The AI Tutor is temporarily unavailable. Please try again.' },
      { status: 500 },
    );
  }
}
