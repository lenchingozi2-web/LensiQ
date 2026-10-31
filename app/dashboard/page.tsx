import { createClient } from '../../lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { includesLiveClass, isPaidPlan } from '../../lib/plans';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [{ data: results }, { data: profile }, { data: storageBytes }] = await Promise.all([
    supabase.from('exam_results').select('id, test_title, score, total_questions, percentage, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('role, plan, plan_expires_at, wallet_reset_at, voice_minutes_balance, text_teaching_balance, storage_limit_bytes').eq('id', user.id).single(),
    supabase.rpc('get_user_teaching_storage_bytes', { p_user_id: user.id }),
  ]);
  const isAdmin = profile?.role === 'admin';
  const isPremium = isAdmin || (isPaidPlan(profile?.plan) && (!profile?.plan_expires_at || new Date(profile.plan_expires_at) > new Date()));
  const hasLiveClass = isAdmin || (isPremium && includesLiveClass(profile?.plan));
  const voiceMinutes = Number(profile?.voice_minutes_balance ?? 0);
  const textCredits = Number(profile?.text_teaching_balance ?? 0);
  const retainedBytes = Number(storageBytes ?? 0);
  const storageLimit = Number(profile?.storage_limit_bytes ?? 100 * 1024 * 1024);

  const totalExams = results?.length ?? 0;
  const averagePercentage = totalExams > 0 ? Math.round(results!.reduce((sum, result) => sum + result.percentage, 0) / totalExams) : 0;
  const latestScore = results?.[0]?.percentage ?? 0;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-3xl bg-gradient-to-br from-[#0B1220] to-[#1c2d46] p-8 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">Learner dashboard</p>
          <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Welcome back to LenxiQ.</h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">A clear place to continue studying, practise exam questions, and manage your learning resources.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/teach" className="rounded-xl bg-[#E8A23D] px-5 py-3 text-sm font-black text-[#0B1220] hover:bg-amber-500">Open teaching room</Link>
              {hasLiveClass ? <Link href="/voice?mode=class" className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15">Live Class</Link> : <Link href="/pricing" className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15">Unlock Live Class</Link>}
            </div>
          </div>
        </header>

        <section aria-label="Quick study actions" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/curriculum', title: 'Explore topics', detail: 'Find the next course concept', icon: '01' },
            { href: '/browse', title: 'Question bank', detail: 'Practise MCQs and theory', icon: '02' },
            { href: '/exam', title: 'Mock exam', detail: 'Check your recall', icon: '03' },
            { href: hasLiveClass ? '/voice?mode=class' : '/pricing', title: hasLiveClass ? 'Live Class' : 'Unlock Live Class', detail: hasLiveClass ? 'Talk, draw and explore in 3D' : 'See All Access options', icon: '04' },
          ].map((action) => (
            <Link key={action.href} href={action.href} className="group flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md">
              <span className="flex items-center justify-between text-[11px] font-black tracking-widest text-slate-400">{action.icon}<span aria-hidden="true" className="text-xl text-[#b77a21] transition-transform group-hover:translate-x-1">↗</span></span>
              <span><span className="block text-base font-black text-[#0B1220]">{action.title}</span><span className="mt-1 block text-xs text-slate-500">{action.detail}</span></span>
            </Link>
          ))}
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a5d00]">Your learning wallet</p><h2 className="mt-2 text-xl font-black text-[#0b1220]">{isAdmin ? 'Administrator access' : isPremium ? 'Premium study balances' : 'Foundation Scholar access'}</h2></div>{isPremium && hasLiveClass && !isAdmin && voiceMinutes <= 5 && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">Voice balance is low</span>}</div>{isAdmin ? <p className="mt-5 text-sm font-bold text-emerald-700">Unlimited access to all courses, explanations, teaching, practical systems, quizzes, and Live Class. No wallet deduction applies.</p> : isPremium ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Live Class access</p><p className="mt-2 text-3xl font-black text-[#0b1220]">{hasLiveClass ? `${voiceMinutes} min` : 'Not included'}</p><p className="mt-1 text-xs font-semibold text-slate-500">{hasLiveClass ? 'Refreshes monthly' : 'Upgrade to All Access to teach by voice'}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Text-teaching credits</p><p className="mt-2 text-3xl font-black text-[#0b1220]">{textCredits}</p><p className="mt-1 text-xs font-semibold text-slate-500">Resets to 50 on your billing date · no rollover</p></div></div> : <p className="mt-5 text-sm font-semibold leading-6 text-slate-500">Upgrade to Premium Study for the full catalogue and text tutoring, or All Access for interactive Live Class.</p>}{isPremium && !isAdmin && <p className="mt-4 text-xs font-semibold text-slate-400">Next wallet reset: {profile?.wallet_reset_at ? new Date(profile.wallet_reset_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'not scheduled'}</p>}<Link href="/wallet" className="mt-5 inline-flex rounded-lg bg-[#0B1220] px-3 py-2 text-sm font-black text-white hover:bg-slate-800">View wallet and history →</Link></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Teaching storage</p><p className="mt-3 text-3xl font-black text-[#0b1220]">{(retainedBytes / (1024 * 1024)).toFixed(1)} <span className="text-base">/ {(storageLimit / (1024 * 1024)).toFixed(0)} MB</span></p><div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-[#e8a23d]" style={{ width: `${Math.min(100, (retainedBytes / Math.max(storageLimit, 1)) * 100)}%` }} /></div><p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Persistent lecture files only. Temporary search uploads are not counted.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/files" className="inline-flex rounded-lg bg-[#0B1220] px-3 py-2 text-sm font-black text-white hover:bg-slate-800">Manage retained files →</Link><Link href="/teach" className="inline-flex items-center text-sm font-black text-[#9a5d00]">Open Teaching Room →</Link></div></article>
        </section>

        <section className="mt-8 grid gap-5 sm:grid-cols-3">
          {[
            { label: 'Recent exam attempts', value: totalExams.toString(), detail: 'Up to 50 latest attempts' },
            { label: 'Average recent score', value: `${averagePercentage}%`, detail: 'Among recent recorded attempts' },
            { label: 'Latest score', value: `${latestScore}%`, detail: totalExams ? formatDate(results![0].created_at) : 'No exam yet' },
          ].map((stat) => (
            <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{stat.label}</p>
              <p className="mt-3 text-4xl font-black text-[#0B1220]">{stat.value}</p>
              <p className="mt-2 text-sm font-medium text-slate-500">{stat.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E8A23D]">Revision activity</p>
            <h2 className="mt-2 text-2xl font-black text-[#0B1220]">Recent mock exams</h2><p className="mt-1 text-sm text-slate-500">Your latest attempts, with scores and dates.</p>
          </div>
          <Link href="/exam" className="inline-flex rounded-xl bg-[#0B1220] px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">Take a new mock exam →</Link>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {totalExams === 0 ? (
            <div className="p-10 text-center sm:p-16">
              <h3 className="text-xl font-black text-slate-900">Your exam history is ready for its first entry.</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">Complete a mock exam to see scores, percentages, and your progress over time.</p>
              <Link href="/exam" className="mt-6 inline-flex rounded-xl bg-[#E8A23D] px-5 py-3 text-sm font-black text-[#0B1220] hover:bg-amber-500">Start your first exam</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left" aria-label="Recent mock exam results">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr><th className="px-6 py-4 font-black">Exam title</th><th className="px-6 py-4 font-black">Score</th><th className="px-6 py-4 font-black">Percentage</th><th className="px-6 py-4 text-right font-black">Completed</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results?.slice(0, 15).map((result) => (
                    <tr key={result.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-6 py-5 font-bold text-slate-800">{result.test_title}</td>
                      <td className="px-6 py-5 font-medium text-slate-600">{result.score} / {result.total_questions}</td>
                      <td className="px-6 py-5"><span className={`rounded-full px-3 py-1 text-sm font-black ${result.percentage >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{result.percentage}%</span></td>
                      <td className="px-6 py-5 text-right text-sm font-medium text-slate-400">{formatDate(result.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
