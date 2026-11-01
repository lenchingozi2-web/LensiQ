import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { checkAccess } from '../../../lib/gatekeeper';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Get the user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ content: "You must be logged in to use the AI Tutor." }, { status: 401 });
    }
    const userId = user.id;

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
    const rawQuestionId = body.questionId;
    const rawQuestionText = body.questionText;
    const rawCorrectAnswer = body.correctAnswer;
    const questionId: string = String(rawQuestionId ?? '');
    const questionText: string = String(rawQuestionText ?? '');
    const options = body.options;
    const correctAnswer: string = String(rawCorrectAnswer ?? '');
    const rawModelAnswer = body.modelAnswer;
    const modelAnswer: string = String(rawModelAnswer ?? '');
    if (
      typeof rawQuestionId !== 'string' || !questionId || questionId.length > 128 ||
      typeof rawQuestionText !== 'string' || !questionText.trim() || questionText.length > 6000 ||
      typeof rawCorrectAnswer !== 'string' || !correctAnswer || correctAnswer.length > 2000 ||
      !options || typeof options !== 'object' || Array.isArray(options) || Object.entries(options as Record<string, unknown>).length > 20 ||
      Object.values(options as Record<string, unknown>).some((option) => typeof option !== 'string' || option.length > 1000) ||
      ((rawModelAnswer !== undefined && rawModelAnswer !== null && typeof rawModelAnswer !== 'string') || modelAnswer.length > 2000)
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

    // No saved explanation exists; call the configured medical tutor model.
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ content: 'AI provider is not configured.', flagged: false }, { status: 503 });
    }

    // --- 6. Provider request ---
    const systemPrompt = `You are the LenxiQ medical tutor. Explain the correct answer with concise, clinically sound reasoning. Return strictly valid JSON with keys "content", "flagged", "flag_reason".`;
    const userPrompt = `Question: ${questionText}\nOptions: ${JSON.stringify(options)}\nCorrect Answer: ${correctAnswer}\nStored Model Answer: ${modelAnswer || 'None provided.'}`;
    const model = (process.env.GEMINI_EXPLAIN_MODEL || 'gemini-3.8-flash').replace('models/', '');
    if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) {
      return NextResponse.json({ content: 'The explanation model is misconfigured.', flagged: false }, { status: 503 });
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: AbortSignal.timeout(45_000),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: 'LOW' },
        },
      }),
    });
    if (!response.ok) {
      console.error('AI explanation provider rejected request', { status: response.status, model });
      return NextResponse.json({ content: 'The AI explanation service is busy. Please try again.', flagged: false }, { status: response.status === 429 ? 429 : 502 });
    }
    const provider = await response.json();
    const text = provider?.candidates?.[0]?.content?.parts?.filter(
      (part: { thought?: boolean; text?: string }) => !part.thought
    ).map((part: { text?: string }) => part.text || '').join('') || '';
    let aiResponseJson: { content: string; flagged: boolean; flag_reason?: string | null };
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.content !== 'string' || !parsed.content.trim()) throw new Error('Missing explanation');
      aiResponseJson = { content: parsed.content, flagged: parsed.flagged === true,
        flag_reason: typeof parsed.flag_reason === 'string' ? parsed.flag_reason : null };
    } catch {
      return NextResponse.json({ content: 'The tutor returned an incomplete explanation. Please retry.', flagged: false }, { status: 502 });
    }

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
