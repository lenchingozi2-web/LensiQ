import { createClient } from '@/lib/supabase/server';
import { includesLiveClass } from '@/lib/plans';
import { compileStep } from '@/lib/rag/syllabus-compiler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
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
  const action = body?.action;
  const itemId = body?.itemId ?? '';
  const offset = body?.offset ?? 0;
  if (!['prepare','parse','publish','node','lesson'].includes(action) ||
      (['parse','node','lesson'].includes(action) && (typeof itemId !== 'string' || !UUID.test(itemId))) ||
      !Number.isSafeInteger(offset) || offset < 0 || (offset !== 0 && (offset - 2) % 32 !== 0)) {
    return Response.json({error:'Invalid compilation checkpoint'},{status:400});
  }
  try {
    return Response.json(await compileStep(user.id, syllabusId, action, itemId, offset, AbortSignal.any([request.signal,AbortSignal.timeout(42000)])));
  } catch (error) {
    return Response.json({error:error instanceof Error ? error.message : 'Compilation step failed'},{status:503});
  }
}
