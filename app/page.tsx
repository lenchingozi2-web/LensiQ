import Link from 'next/link';

const journeys = [
  {
    href: '/curriculum',
    label: 'Study path',
    title: 'Follow the curriculum',
    description: 'Move from the Year 4 timetable into a topic, then launch teaching and connected questions from one place.',
    tone: 'gold',
    icon: '01',
  },
  {
    href: '/browse',
    label: 'Practice bank',
    title: 'Practise real questions',
    description: 'Browse MCQs, theory, and practical material by course, division, and format.',
    tone: 'blue',
    icon: '02',
  },
  {
    href: '/search',
    label: 'Discovery',
    title: 'Find matching questions',
    description: 'Search a concept or upload lecture material to surface the closest preserved exam questions.',
    tone: 'teal',
    icon: '03',
  },
];

const teachingModes = [
  { href: '/teach', eyebrow: 'Text teaching', title: 'Ask LenxiQ anything', description: 'A persistent teaching room grounded in your course material and past questions.', icon: 'Aa' },
  { href: '/voice', eyebrow: 'Voice Tutor', title: 'Learn by speaking', description: 'Start a secure realtime voice session with the medical tutor.', icon: '◉' },
  { href: '/voice?mode=class', eyebrow: 'Live Class', title: 'Enter the live room', description: 'A focused live-teaching foundation for guided classroom-style sessions.', icon: '▶' },
];

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB]">
      <section className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 pb-12 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[1.18fr_0.82fr] lg:px-8 lg:pb-16 lg:pt-16">
        <div className="flex flex-col justify-center">
          <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-[#9A5D00]">
            <span className="h-2 w-2 rounded-full bg-[#E8A23D]" /> Year 4 medical learning platform
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.055em] text-[#0B1220] sm:text-6xl lg:text-7xl">Study with a plan. Practise with purpose.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">LenxiQ brings your curriculum, preserved past questions, grounded AI teaching, and realtime voice learning into one focused study system.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/curriculum" className="rounded-xl bg-[#0B1220] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800">Open my study path</Link>
            <Link href="/teach" className="rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-black text-[#0B1220] shadow-sm hover:border-slate-400 hover:bg-slate-50">Start AI teaching</Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-slate-500">
            <span>5 course pathways</span><span>Complete MCQ options</span><span>Persistent teaching sessions</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] bg-[#0B1220] p-6 text-white shadow-2xl shadow-slate-900/15 sm:p-8">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#E8A23D]/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E8A23D]">Your command centre</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Choose the next right move.</h2>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-black text-[#E8A23D]">LQ</span>
            </div>
            <div className="mt-8 space-y-3">
              <Link href="/search" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 p-4 hover:bg-white/15">
                <span><span className="block text-sm font-black">Search a topic</span><span className="mt-1 block text-xs text-slate-300">Find exact question-bank matches</span></span><span className="text-xl text-[#E8A23D]">→</span>
              </Link>
              <Link href="/voice" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 p-4 hover:bg-white/15">
                <span><span className="block text-sm font-black">Speak with the tutor</span><span className="mt-1 block text-xs text-slate-300">Start Voice Tutor</span></span><span className="text-xl text-[#E8A23D]">→</span>
              </Link>
              <Link href="/exam" className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 p-4 hover:bg-white/15">
                <span><span className="block text-sm font-black">Test yourself</span><span className="mt-1 block text-xs text-slate-300">Run an exam-style session</span></span><span className="text-xl text-[#E8A23D]">→</span>
              </Link>
            </div>
            <div className="mt-8 border-t border-white/10 pt-5 text-xs leading-5 text-slate-400">Course-specific material is prioritised for teaching, while broader medical knowledge fills genuine gaps when useful.</div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Learn in the right order</p><h2 className="mt-2 text-2xl font-black tracking-tight text-[#0B1220] sm:text-3xl">Your study journeys</h2></div><Link href="/curriculum" className="hidden text-sm font-black text-[#9A5D00] hover:text-[#0B1220] sm:block">View all pathways →</Link></div>
        <div className="grid gap-4 lg:grid-cols-3">
          {journeys.map((journey) => (
            <Link key={journey.href} href={journey.href} className={`group rounded-3xl border p-6 shadow-sm hover:-translate-y-1 hover:shadow-lg ${journey.tone === 'gold' ? 'border-amber-200 bg-[#FFF9EE]' : journey.tone === 'blue' ? 'border-blue-100 bg-[#F5F8FF]' : 'border-teal-100 bg-[#F2FBF9]'}`}>
              <div className="flex items-start justify-between gap-4"><span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{journey.label}</span><span className="text-sm font-black text-slate-400">{journey.icon}</span></div>
              <h3 className="mt-8 text-xl font-black text-[#0B1220]">{journey.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{journey.description}</p><span className="mt-6 inline-block text-sm font-black text-[#0B1220] group-hover:text-[#9A5D00]">Open journey →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Teaching modes</p><h2 className="mt-2 text-2xl font-black tracking-tight text-[#0B1220]">Learn in the mode that suits the moment.</h2></div><Link href="/pricing" className="text-sm font-black text-[#9A5D00] hover:text-[#0B1220]">See premium access →</Link></div>
          <div className="grid gap-3 md:grid-cols-3">{teachingModes.map((mode) => <Link key={mode.href} href={mode.href} className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 hover:border-[#E8A23D] hover:bg-white"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1220] text-sm font-black text-[#E8A23D]">{mode.icon}</span><span className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">{mode.eyebrow}</span></div><h3 className="mt-5 text-lg font-black text-[#0B1220]">{mode.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{mode.description}</p><span className="mt-4 block text-sm font-black text-[#9A5D00]">Enter →</span></Link>)}</div>
        </div>
      </section>
    </div>
  );
}
