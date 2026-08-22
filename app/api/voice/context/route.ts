import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase/service';
import { buildTeachingContext } from '../../../../lib/ai/teaching-context';

function expectedSignature(payload: string) {
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!secret) return null;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function isValidBearer(request: Request, payload: string) {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const expected = expectedSignature(payload);
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const courseName = typeof body?.courseName === 'string' ? body.courseName.trim().slice(0, 120) : '';
  const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 300) : '';
  const payload = JSON.stringify({ userId, courseName, query });

  if (!userId || !courseName || !query || !isValidBearer(request, payload)) {
    return NextResponse.json({ error: 'Invalid Live Class context request.' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const context = await buildTeachingContext(supabase, courseName, [{ role: 'user', content: query }]);
    return NextResponse.json({
      knowledge: context.knowledgeSources.slice(0, 6).map((source) => ({
        title: source.title,
        course: source.course,
        excerpt: source.content?.trim().slice(0, 900) || '',
      })).filter((source) => source.excerpt),
      questions: context.questions.slice(0, 8).map((question) => ({
        type: question.type,
        topic: question.topic,
        question: question.question_text?.trim().slice(0, 700) || '',
        answer: (question.correct_answer || question.model_answer || '').trim().slice(0, 600),
      })).filter((question) => question.question),
    });
  } catch (error) {
    console.error('Live Class per-turn context lookup failed:', error);
    return NextResponse.json({ error: 'Live Class context lookup failed.' }, { status: 503 });
  }
}
