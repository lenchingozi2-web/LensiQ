import {usageFromPayload} from '@/lib/ai/usage-meter';
import {finishAiRequest,recordAiUsage} from '@/lib/ai/record-usage';
import { createServiceClient } from '@/lib/supabase/service';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
import { createClient } from '../../../lib/supabase/server';
import { checkAccess } from '../../../lib/gatekeeper';

export async function POST(req: Request) {
  let reservationId:string|undefined;
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
    let questionText: string = String(rawQuestionText ?? '');
    let options = body.options;
    let correctAnswer: string = String(rawCorrectAnswer ?? '');
    const rawModelAnswer = body.modelAnswer;
    let modelAnswer: string = String(rawModelAnswer ?? '');
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

    // Use the protected question bank as the source of truth for the shared cache.
    // A caller must never supply a forged answer for another question's ID.
    const { data: canonical, error: questionError } = await supabase
      .from('questions')
      .select('question_text,correct_answer,model_answer,option_a,option_b,option_c,option_d,option_e')
      .eq('id', questionId)
      .maybeSingle();
    if (questionError || !canonical) {
      return NextResponse.json({ content: questionError ? 'The question could not be loaded. Please retry.' : 'Question not found.', flagged: false }, { status: questionError ? 503 : 404 });
    }
    questionText = String(canonical.question_text ?? '').slice(0, 6000);
    correctAnswer = String(canonical.correct_answer || canonical.model_answer || '').slice(0, 2000);
    modelAnswer = String(canonical.model_answer ?? '').slice(0, 2000);
    options = Object.fromEntries((['a','b','c','d','e'] as const).map(letter => [letter.toUpperCase(), String(canonical[`option_${letter}`] ?? '').slice(0,1000)]));

    const access = await checkAccess('explanation');
    reservationId=access.reservationId;
    if (!access.allowed) {
      return NextResponse.json(
        { content: access.message || "Limit reached.", flagged: false },
        { status: access.status || 403 }
      );
    }
    // =========================================================================

    const cacheService = createServiceClient();
    // 4. THE CACHE CHECK: Look for an existing explanation
    const { data: cachedExplanation } = await cacheService
      .from('question_explanations')
      .select('*')
      .eq('question_id', questionId)
      .single();

    if (cachedExplanation) {
      await recordAiUsage(userId,'explanation',{provider:'gemini',model:'cache',inputTokens:0,outputTokens:0,cachedTokens:0,thinkingTokens:0,tokenSource:'cache',estimatedCostUsd:0},{reservationId,outcome:'cache'});
      return NextResponse.json({
        content: cachedExplanation.explanation_text,
        flagged: cachedExplanation.is_flagged
      });
    }

    // No saved explanation exists; call the configured medical tutor model.
    if (!process.env.GEMINI_API_KEY) {
      await finishAiRequest(reservationId,false);
      return NextResponse.json({ content: 'AI provider is not configured.', flagged: false }, { status: 503 });
    }

    // --- 6. Provider request ---
    const systemPrompt = `You are the LenxiQ medical tutor. Explain the correct answer with concise, clinically sound reasoning. Return strictly valid JSON with keys "content", "flagged", "flag_reason".`;
    const userPrompt = `Question: ${questionText}\nOptions: ${JSON.stringify(options)}\nCorrect Answer: ${correctAnswer}\nStored Model Answer: ${modelAnswer || 'None provided.'}`;
    const primaryModel = (process.env.GEMINI_EXPLAIN_MODEL || 'gemini-3.8-flash').replace(/^models\//, '');
    const fallbackModel = (process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.6-flash').replace(/^models\//, '');
    const models = [...new Set([primaryModel, fallbackModel])];
    if (models.some((model) => !/^[a-zA-Z0-9._-]{1,80}$/.test(model))) {
      await finishAiRequest(reservationId,false);
      return NextResponse.json({ content: 'The explanation model is misconfigured.', flagged: false }, { status: 503 });
    }
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: 'LOW' },
      },
    });
    let provider: { candidates?: Array<{ content?: { parts?: Array<{ thought?: boolean; text?: string }> } }> } | null = null;
    let usedModel=primaryModel;
    let lastStatus: number | null = null;
    const retryable = new Set([429, 500, 502, 503, 504]);
    const deadline = Date.now() + 45_000;
    providerLoop:
    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      const model = models[modelIndex];
      const attempts = modelIndex === 0 ? 2 : 1;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const remainingMs = deadline - Date.now();
        if (remainingMs < 3500) break providerLoop;
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            signal: AbortSignal.timeout(Math.min(20_000, remainingMs - 1000)),
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': process.env.GEMINI_API_KEY!,
            },
            body: payload,
          });
          if (response.ok) {
            provider = await response.json();usedModel=model;
            break providerLoop;
          }
          lastStatus = response.status;
          console.error('AI explanation Gemini provider unavailable', { status: response.status, model, attempt: attempt + 1 });
          await response.body?.cancel().catch(() => undefined);
          if (!retryable.has(response.status)) break providerLoop;
        } catch (error) {
          console.error('AI explanation Gemini transport failure', {
            model,
            name: error instanceof Error ? error.name : 'unknown',
          });
        }
        if (attempt + 1 < attempts && deadline - Date.now() > 4000) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
      }
    }
    if (!provider) {
      await finishAiRequest(reservationId,false);
      return NextResponse.json({
        content: 'The AI explanation service is temporarily unavailable. Please try again.',
        flagged: false,
      }, { status: lastStatus === 429 ? 429 : 503 });
    }
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
      await recordAiUsage(userId,'explanation',usageFromPayload(provider,'gemini',usedModel,payload.length,text.length),{reservationId,success:false,outcome:'invalid'});
      return NextResponse.json({ content: 'The tutor returned an incomplete explanation. Please retry.', flagged: false }, { status: 502 });
    }

    await recordAiUsage(userId,'explanation',usageFromPayload(provider,'gemini',usedModel,payload.length,text.length),{reservationId});
    // 6. SAVE TO CACHE for the next user
    await cacheService.from('question_explanations').insert({
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
    await finishAiRequest(reservationId,false);
    console.error('AI Generation Error:', error instanceof Error ? error.name : 'unknown_error');
    return NextResponse.json(
      { content: "The AI Tutor is currently analyzing other charts. Please try again.", flagged: false },
      { status: 500 }
    );
  }
}
