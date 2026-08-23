import Link from 'next/link';
import { checkAccess } from '../../../../lib/gatekeeper';

export default async function DivisionPage({ params }: { params: Promise<{ subject: string, division: string }> }) {
  const resolvedParams = await params;
  const subjectId = resolvedParams.subject;
  const divisionName = decodeURIComponent(resolvedParams.division);
  const title = subjectId.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  const browseAccess = await checkAccess('browse', title);
  if (!browseAccess.allowed) {
    return <main className="min-h-[calc(100vh-4.5rem)] bg-slate-50 px-4 py-12 text-center sm:px-6"><div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-8 shadow-xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A5D00]">Question bank access</p><h1 className="mt-3 text-3xl font-black text-[#0B1220]">This course is locked</h1><p className="mt-4 leading-7 text-slate-600">{browseAccess.message || 'Your free plan includes one selected course. Upgrade to Premium to open the complete question bank.'}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/pricing" className="rounded-xl bg-[#E8A23D] px-6 py-3 font-black text-[#0B1220]">View subscription plans</Link><Link href={`/browse/${subjectId}`} className="rounded-xl border border-slate-200 px-6 py-3 font-bold text-slate-700">Back to divisions</Link></div></div></main>;
  }

  const formats = [
    { type: 'mcq', eyebrow: 'Test yourself', title: 'Multiple Choice', description: 'Practice objective questions with options, answers, and explanations.', icon: '01' },
    { type: 'theory', eyebrow: 'Build depth', title: 'Theory Questions', description: 'Review long-form questions with structured model answers.', icon: '02' },
    { type: 'practical', eyebrow: 'Premium practicals', title: 'Practical Materials', description: 'Study specimen images, practical prompts, and verified model answers.', icon: '03', premium: true },
  ];

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href={`/browse/${subjectId}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-[#E8A23D]">← Back to {title} divisions</Link>
        <div className="mt-8 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">{title}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[#0B1220] sm:text-5xl">{divisionName}</h1>
          <p className="mt-4 text-lg leading-8 text-slate-500">Choose a study mode for this division. Work from the question format that matches your next revision goal.</p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {formats.map((format) => (
            <Link key={format.type} href={`/browse/${subjectId}/${encodeURIComponent(divisionName)}/${format.type}`} className="group block h-full">
              <article className={`relative flex h-full min-h-64 flex-col justify-between overflow-hidden rounded-3xl border p-7 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl ${format.premium ? 'border-[#E8A23D]/50 bg-[#0B1220] text-white' : 'border-slate-200 bg-white text-[#0B1220]'}`}>
                <div className="flex items-start justify-between">
                  <span className={`text-xs font-black uppercase tracking-[0.2em] ${format.premium ? 'text-[#E8A23D]' : 'text-slate-400'}`}>{format.eyebrow}</span>
                  <span className={`text-3xl font-black ${format.premium ? 'text-white/20' : 'text-slate-100'}`}>{format.icon}</span>
                </div>
                <div>
                  <h2 className={`text-2xl font-black ${format.premium ? 'text-white' : 'text-[#0B1220]'} group-hover:text-[#E8A23D]`}>{format.title}</h2>
                  <p className={`mt-3 text-sm leading-6 ${format.premium ? 'text-slate-300' : 'text-slate-500'}`}>{format.description}</p>
                  <span className={`mt-6 inline-flex text-sm font-black ${format.premium ? 'text-[#E8A23D]' : 'text-slate-700'}`}>Open format <span className="ml-2 transition-transform group-hover:translate-x-1">→</span></span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
