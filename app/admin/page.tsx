import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: admin } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (admin?.role !== 'admin') redirect('/dashboard');

  const [{ data: site }, { count: explanations }, { data: flags }, { data: retention }] = await Promise.all([
    supabase.from('site_settings').select('is_practical_launched').eq('id', 1).maybeSingle(),
    supabase.from('question_explanations').select('id', { count: 'exact', head: true }),
    supabase.from('answer_flags').select('id, flag_reason, created_at, questions (text)')
      .eq('status', 'pending').order('created_at', { ascending: false }).limit(30),
    supabase.rpc('get_admin_financial_summary'),
  ]);
  const summary = Array.isArray(retention) ? retention[0] : retention;
  const practicalLaunched = site?.is_practical_launched === true;

  async function togglePracticals() {
    'use server';
    const client = await createClient();
    const { data: { user: operator } } = await client.auth.getUser();
    if (!operator) return;
    const { data: role } = await client.from('profiles').select('role')
      .eq('id', operator.id).maybeSingle();
    if (role?.role !== 'admin') return;
    const { data: current } = await client.from('site_settings')
      .select('is_practical_launched').eq('id', 1).maybeSingle();
    if (!current) return;
    const { error } = await client.from('site_settings')
      .update({ is_practical_launched: !current.is_practical_launched }).eq('id', 1);
    if (error) throw new Error('Unable to update practicals availability.');
    revalidatePath('/admin');
    revalidatePath('/pricing');
  }

  return (
    <main className="min-h-screen bg-[#F6F8FB] px-4 py-8 sm:px-7 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0B1220] via-[#182a44] to-[#263e59] p-7 text-white shadow-xl sm:p-10">
          <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 h-60 w-60 rounded-full bg-[#E8A23D]/15 blur-3xl" />
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E8A23D]">LenxiQ AI · Administration</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Platform control centre</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Monitor learning infrastructure, review flagged content, and manage access to practical learning resources.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin/ai-usage" className="rounded-xl bg-[#E8A23D] px-4 py-3 text-sm font-black text-[#0B1220] hover:bg-amber-400">AI service status</Link>
            <Link href="/dashboard" className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20">Learner dashboard</Link>
          </div>
        </header>

        <section aria-label="Platform overview" className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            { name: 'Pending content flags', value: flags?.length ?? 0, detail: 'Most recent 30 submitted flags' },
            { name: 'Cached explanations', value: explanations ?? 0, detail: 'Stored question explanations' },
            { name: 'Recording maintenance', value: Number(summary?.recordings_expiring_7d ?? 0), detail: 'Scheduled to expire within 7 days' },
          ].map((card) => (
            <article key={card.name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{card.name}</p>
              <p className="mt-3 text-3xl font-black text-[#0B1220]">{card.value.toLocaleString()}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9A5D00]">Content availability</p>
            <h2 className="mt-2 text-xl font-black text-[#0B1220]">Practical learning</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Control whether the interactive practical catalogue is launched. This does not modify existing subscriptions or study records.</p>
            <form action={togglePracticals} className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <span className={`text-sm font-black ${practicalLaunched ? 'text-emerald-700' : 'text-slate-600'}`}>
                {practicalLaunched ? 'Available to eligible students' : 'Not launched'}
              </span>
              <button type="submit" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-800 hover:border-amber-300">Change status</button>
            </form>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9A5D00]">AI operations</p>
            <h2 className="mt-2 text-xl font-black text-[#0B1220]">Tutor and infrastructure</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">View tutor configuration and service availability without exposing credentials.</p>
            <Link href="/admin/ai-usage" className="mt-6 inline-flex rounded-xl bg-[#0B1220] px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">Check AI services</Link>
          </article>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-xl font-black text-[#0B1220]">Flagged study content</h2>
            <p className="mt-1 text-xs text-slate-500">Review learner-reported questions before applying editorial corrections.</p>
          </header>
          {!flags?.length ? (
            <p className="p-8 text-center text-sm font-semibold text-slate-500">No pending content flags.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {flags.map((flag) => (
                <li key={flag.id} className="p-5 sm:px-6">
                  <p className="text-sm font-bold leading-6 text-slate-800">
                    {flag.questions && typeof flag.questions === 'object' &&
                     'text' in flag.questions && typeof flag.questions.text === 'string'
                      ? flag.questions.text : 'Question details unavailable'}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-amber-800">{flag.flag_reason}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
