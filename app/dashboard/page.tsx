import { createClient } from '../../lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: results } = await supabase
    .from('exam_results')
    .select('id, test_title, score, total_questions, percentage, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

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
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Welcome back, Doctor.</h1>
              <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">Track your mock-exam performance, continue with grounded teaching, and keep your revision moving.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/teach" className="rounded-xl bg-[#E8A23D] px-5 py-3 text-sm font-black text-[#0B1220] hover:bg-amber-500">Open teaching room</Link>
              <Link href="/voice" className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15">Voice tutor</Link>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-5 sm:grid-cols-3">
          {[
            { label: 'Mock exams completed', value: totalExams.toString(), detail: 'All recorded attempts' },
            { label: 'Average score', value: `${averagePercentage}%`, detail: 'Across completed exams' },
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
            <h2 className="mt-2 text-2xl font-black text-[#0B1220]">Recent mock exams</h2>
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
              <table className="w-full min-w-[640px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr><th className="px-6 py-4 font-black">Exam title</th><th className="px-6 py-4 font-black">Score</th><th className="px-6 py-4 font-black">Percentage</th><th className="px-6 py-4 text-right font-black">Completed</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results?.map((result) => (
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
