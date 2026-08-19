import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { checkAccess } from '../../../lib/gatekeeper';
import { buildTeachingContext } from '../../../lib/ai/teaching-context';
import { buildTeachingSystemPrompt } from '../../../lib/ai/teaching-prompt';

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

    const { data: adminSettings } = await supabase
      .from('site_settings')
      .select('is_ai_tutor_enabled')
      .eq('id', 1)
      .single();

    if (adminSettings && adminSettings.is_ai_tutor_enabled === false) {
      return NextResponse.json(
        { error: 'ai_paused', message: 'The AI Tutor is currently paused for maintenance. Please check back shortly.' },
        { status: 503 },
      );
    }

    const body = await req.json();
    const courseName = typeof body?.courseName === 'string' ? body.courseName : 'Pharmacology';
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

    if (messages.length === 0 || messages.length > 40) {
      return NextResponse.json({ error: 'Invalid teaching conversation.' }, { status: 400 });
    }

    if (messages.length === 1) {
      const access = await checkAccess('teaching');
      if (!access.allowed) {
        return NextResponse.json({ error: access.message }, { status: access.status });
      }
    }

    const context = await buildTeachingContext(supabase, courseName, messages);
    const systemPrompt = buildTeachingSystemPrompt(courseName, context);

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        stream: true,
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
