import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getCurriculumCourses, getCurriculumTopics } from '@/lib/curriculum';

export const dynamic = 'force-dynamic';

export default async function CurriculumPage() {
  const supabase = await createClient();
  const courses = await getCurriculumCourses(supabase);
  const courseCards = await Promise.all(courses.map(async (course) => ({ course, topicCount: (await getCurriculumTopics(supabase, course.id)).length })));

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB] px-4 pb-16 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl pt-8 sm:pt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-sm font-black text-slate-500 hover:text-[#0B1220]">← Home</Link><div className="flex flex-wrap gap-2 text-xs font-black"><Link href="/search" className="rounded-full bg-white px-3 py-2 text-slate-600 shadow-sm">Search questions</Link><Link href="/voice" className="rounded-full bg-white px-3 py-2 text-slate-600 shadow-sm">Voice Tutor</Link><Link href="/voice?mode=class" className="rounded-full bg-white px-3 py-2 text-slate-600 shadow-sm">Live Class</Link></div></div>
        <div className="overflow-hidden rounded-[2rem] bg-[#0B1220] px-6 py-10 text-white shadow-[0_25px_80px_rgba(11,18,32,0.22)] sm:px-10 lg:px-14 lg:py-14"><div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.25em] text-[#E8A23D]">Year 4 learning map</p><h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-6xl">Study with a destination, not a pile of files.</h1><p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">Follow your course from foundations to consolidation. Open any topic to see its place in the timetable, launch AI teaching, and surface the closest preserved past questions.</p></div><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/search" className="rounded-xl bg-[#E8A23D] px-5 py-3 text-center text-sm font-black text-[#0B1220] hover:bg-amber-400">Search past questions</Link><Link href="/teach" className="rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/10">Open text teaching</Link></div></div>
        <div className="mt-10 flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Choose a branch</p><h2 className="mt-2 text-2xl font-black tracking-tight text-[#0B1220] sm:text-3xl">Your course pathways</h2></div><span className="hidden text-sm font-bold text-slate-500 sm:block">{courses.length} integrated courses</span></div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">{courseCards.map(({ course, topicCount }) => <Link key={course.id} href={`/curriculum/${course.slug}`} className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl sm:p-8"><span className="absolute right-0 top-0 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: course.accent_color }} /><div className="relative flex items-start justify-between gap-4"><div><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{topicCount} timetable topics</span><h2 className="mt-5 text-2xl font-black tracking-tight text-[#0B1220]">{course.name}</h2><p className="mt-3 max-w-md text-sm leading-7 text-slate-500">{course.description}</p></div><span className="mt-1 text-2xl text-slate-300 group-hover:translate-x-1">→</span></div><div className="relative mt-8 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: '68%', backgroundColor: course.accent_color }} /></div><p className="relative mt-3 text-xs font-bold text-slate-400">Open pathway · find questions · teach by text or voice</p></Link>)}</div>
      </section>
    </div>
  );
}
