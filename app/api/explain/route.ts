import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { checkAccess } from '../../../lib/gatekeeper';
import { reserveAiRequest } from '../../../lib/ai/request-budget';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Get the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ content: "You must be logged in to use the AI Tutor." }, { status: 401 });
    }
    const userId = user.id;
    return NextResponse.json(
      { content: 'The AI Tutor is temporarily paused while service usage is reviewed.', flagged: false },
      { status: 503 },
    );

    // =========================================================================
    // STEP 2: THE ADMIN BOUNCER - Check if the Admin Globally Paused AI
    // =========================================================================
    const { data: settings } = await supabase
      .from('site_settings')
      .select('is_ai_tutor_enabled')
      .eq('id', 1)
      .single();

    if (settings?.is_ai_tutor_enabled === false) {
      return NextResponse.json({ 
        content: "✨ The AI Tutor is currently offline for maintenance. Check back soon!",
        flagged: false
      });
    }
    // =========================================================================

    // =========================================================================
    // STEP 3: THE GATEKEEPER LOCK
    // =========================================================================
    const access = await checkAccess('explanation');
    if (!access.allowed) {
      return NextResponse.json(
        { content: access.message || "Limit reached.", flagged: false }, 
        { status: access.status || 403 }
      );
    }
    // =========================================================================
    
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > 32 * 1024) {
      return NextResponse.json({ content: 'The explanation request is too large.', flagged: false }, { status: 413 });
    }
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, 'utf8') > 32 * 1024) {
      return NextResponse.json({ content: 'The explanation request is too large.', flagged: false }, { status: 413 });
    }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ content: 'Invalid explanation request.', flagged: false }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ content: 'Invalid JSON request.', flagged: false }, { status: 400 });
    }
    const questionId = typeof body.questionId === 'string' ? body.questionId : '';
    const questionText = typeof body.questionText === 'string' ? body.questionText : '';
    const options = body.options;
    const correctAnswer = typeof body.correctAnswer === 'string' ? body.correctAnswer : '';
    const modelAnswer = body.modelAnswer;
    if (
      !questionId || questionId.length > 128 ||
      !questionText.trim() || questionText.length > 6000 ||
      !correctAnswer || correctAnswer.length > 2000 ||
      !options || typeof options !== 'object' || Array.isArray(options) || Object.entries(options as Record<string, unknown>).length > 20 ||
      Object.values(options as Record<string, unknown>).some((option) => typeof option !== 'string' || option.length > 1000) ||
      (modelAnswer !== undefined && modelAnswer !== null && (typeof modelAnswer !== 'string' || modelAnswer.length > 2000))
    ) {
      return NextResponse.json({ content: 'Invalid explanation request.', flagged: false }, { status: 400 });
    }

    // 4. THE CACHE CHECK: Look for an existing explanation
    const { data: cachedExplanation } = await supabase
      .from('question_explanations')
      .select('*')
      .eq('question_id', questionId)
      .single();

    if (cachedExplanation) {
      return NextResponse.json({
        content: cachedExplanation.explanation_text,
        flagged: cachedExplanation.is_flagged
      });
    }

    // --- 5. If no cache exists, reserve a budget slot before calling DeepSeek ---
    const budget = await reserveAiRequest(userId, 'explain', req.headers.get('idempotency-key') || undefined);
    if (!budget.allowed) {
      return NextResponse.json(
        { content: 'AI explanations are temporarily at capacity. Please wait a minute and try again.', flagged: false },
        { status: budget.reason === 'budget_unavailable' ? 503 : 429 },
      );
    }
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ content: 'AI provider is not configured.', flagged: false }, { status: 503 });
    }

    // --- 6. Provider request ---
    const apiUrl = 'https://api.deepseek.com/chat/completions';
    const systemPrompt = `You are the LenxIQ tutor... 
    MODE: EXPLAIN — Give a deeper explanation.
    You MUST always respond in strictly valid JSON format matching this exact shape:
    { "content": "...", "flagged": false, "flag_reason": null }`;

    const userPrompt = `
    Question: ${questionText}
    Options: ${JSON.stringify(options)}
    Correct Answer: ${correctAnswer}
    Stored Model Answer: ${modelAnswer || "None provided."}
    `;

    const response = await fetch(apiUrl, {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_EXPLAIN_MODEL || 'deepseek-v4-flash',
        max_tokens: 800,
        response_format: { type: 'json_object' }, 
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`);

    const data = await response.json();
    const aiResponseJson = JSON.parse(data.choices[0].message.content);

    // 6. SAVE TO CACHE for the next user
    await supabase.from('question_explanations').insert({
      question_id: questionId,
      explanation_text: aiResponseJson.content,
      is_flagged: aiResponseJson.flagged
    });

    // 7. Handle Flags
    if (aiResponseJson.flagged) {
      try {
        await supabase.from('answer_flags').insert({
          question_id: questionId,
          flag_reason: aiResponseJson.flag_reason || 'Flagged by AI Tutor',
          raised_by_user_id: userId
        });
      } catch (flagError) {
        console.error("Flag save error:", flagError);
      }
    }
    
    return NextResponse.json(aiResponseJson);

  } catch (error) {
    console.error('AI Generation Error:', error instanceof Error ? error.name : 'unknown_error');
    return NextResponse.json(
      { content: "The AI Tutor is currently analyzing other charts. Please try again.", flagged: false }, 
      { status: 500 }
    );
  }
}
