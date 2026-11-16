import { createClient } from '@/lib/supabase/server';
import { includesLiveClass } from '@/lib/plans';
import { compileStudySyllabus } from '@/lib/rag/syllabus-compiler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Sign in first' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role,plan,plan_expires_at').eq('id',user.id).maybeSingle();
  const paid = profile?.role === 'admin' || (profile?.plan && includesLiveClass(profile.plan)
    && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date()));
  if (!paid) return Response.json({ error: 'Live Class subscription required' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const syllabusId = typeof body?.syllabusId === 'string' ? body.syllabusId : '';
  if (!UUID.test(syllabusId)) return Response.json({ error: 'Invalid syllabus ID' }, { status: 400 });
  const { data: syllabus } = await supabase.from('study_syllabi').select('id').eq('id', syllabusId).eq('user_id',user.id).maybeSingle();
  if (!syllabus) return Response.json({ error: 'Syllabus not found' }, { status: 404 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, value: unknown) => controller.enqueue(encoder.encode('event: ' + event + '\ndata: ' + JSON.stringify(value) + '\n\n'));
      try {
        for await (const progress of compileStudySyllabus(user.id, syllabusId)) {
          if (request.signal.aborted) throw new Error('Compilation request disconnected');
          send('progress', progress);
        }
        send('complete', { ok: true, syllabusId });
      } catch (error) {
        send('error', { error: error instanceof Error ? error.message : 'Compilation failed', syllabusId });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  } });
}
