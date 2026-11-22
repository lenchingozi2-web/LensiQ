import 'server-only';
import { randomInt } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { subscriptionsEnabled } from './subscriptions';

/** Authenticated server action only: no plan counter is changed while billing is paused. */
export async function startOpenTimedMock(db: SupabaseClient, userId: string, subject: string, division: string, count: number) {
  if (subscriptionsEnabled() || !userId) throw new Error('Open-access mock unavailable.');
  if (![10,20,50,100].includes(count) || !subject.trim() || !division.trim() || subject.length > 120 || division.length > 120)
    throw new Error('Invalid question selection.');
  const now = new Date().toISOString();
  const resumed = await db.from('timed_mock_attempts').select('id,expires_at,question_ids')
    .eq('user_id', userId).eq('subject', subject).eq('division', division)
    .is('submitted_at', null).gt('expires_at', now).order('started_at', {ascending:false}).limit(1).maybeSingle();
  if (resumed.error) throw new Error('Unable to restore your mock.');
  let attempt = resumed.data;
  if (!attempt) {
    const escape = (value: string) => value.trim().replace(/[\\%_]/g, '\\$&');
    const ids: string[] = [];
    // Page explicitly; Supabase's default 1,000-row response must not limit the bank.
    for (let page = 0; ; page++) {
      const rows = await db.from('questions').select('id').ilike('subject', escape(subject))
        .ilike('division', escape(division)).eq('type','mcq').order('id')
        .range(page*1000, page*1000+999);
      if (rows.error) throw new Error('Unable to read the selected question bank.');
      for (const row of rows.data ?? []) ids.push(row.id);
      if ((rows.data?.length ?? 0) < 1000) break;
      if (page >= 99) throw new Error('Question bank selection is too large.');
    }
    if (!ids.length) throw new Error('No questions found in this selection.');
    for (let i=ids.length-1;i>0;i--) { const j=randomInt(i+1); [ids[i],ids[j]]=[ids[j],ids[i]]; }
    const selected = ids.slice(0,count);
    const inserted = await db.from('timed_mock_attempts').insert({user_id:userId,subject,division,
      question_ids:selected,expires_at:new Date(Date.now()+selected.length*50_000).toISOString()})
      .select('id,expires_at,question_ids').single();
    if (inserted.error || !inserted.data) throw new Error('Unable to save your timed mock.');
    attempt=inserted.data;
  }
  const questions=await db.from('questions').select('*').in('id',attempt.question_ids);
  if (questions.error) throw new Error('Unable to load your timed mock.');
  const byId=new Map((questions.data??[]).map(row=>[row.id,row]));
  return {id:attempt.id,expiresAt:attempt.expires_at,questions:attempt.question_ids.map((id:string)=>byId.get(id)).filter(Boolean)};
}
