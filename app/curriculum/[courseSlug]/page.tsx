import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurriculumCourse, getCurriculumTopics } from '@/lib/curriculum';

export const dynamic = 'force-dynamic';

export default async function CourseCurriculumPage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const supabase = await createClient();
  const course = await getCurriculumCourse(supabase, courseSlug);
  if (!course) notFound();
  const topics = await getCurriculumTopics(supabase, course.id);
  const days = Array.from(new Set(topics.map((topic) => topic.day_number)));

  return (
    <div className="-mx-4 min-h-[calc(100vh-5rem)] bg-[#F7F8FC] px-4 pb-16">
      <section className="mx-auto max-w-6xl pt-8 sm:pt-12">
        <Link href="/curriculum" className="text-sm font-bold text-slate-500 hover:text-[#0B1220]">← All courses</Link>
        <div className="mt-6 rounded-[2.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: course.accent_color, backgroundColor: `${course.accent_color}18` }}>Year 4 pathway</span>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-[#0B1220] sm:text-5xl">{course.name}</h1>
              <p className="mt-4 text-base leading-8 text-slate-500">{course.description} Every card is a launch point into the question bank and the grounded Teaching Room.</p>
            </div>
            <div className="flex shrink-0 gap-3">
              <Link href={`/teach?course=${encodeURIComponent(course.name)}`} className="rounded-xl bg-[#0B1220] px-5 py-3 text-center text-sm font-black text-white hover:bg-slate-700">Teach this course</Link>
              <Link href={`/search?course=${course.slug}`} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-700 hover:border-slate-300">Search course</Link>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-8">
          {days.map((dayNumber) => {
            const dayTopics = topics.filter((topic) => topic.day_number === dayNumber);
            const dayTitle = dayTopics[0]?.day_title ?? `Day ${dayNumber}`;
            return (
              <section key={dayNumber}>
                <div className="mb-4 flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0B1220] text-sm font-black text-white">{dayNumber}</span>
                  <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#E8A23D]">Study day {dayNumber}</p><h2 className="mt-1 text-xl font-black text-[#0B1220]">{dayTitle}</h2></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {dayTopics.map((topic) => (
                    <Link key={topic.id} href={`/curriculum/${course.slug}/${topic.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
                      <div className="flex items-start justify-between gap-3"><h3 className="text-base font-black leading-6 text-[#0B1220] group-hover:text-slate-700">{topic.title}</h3><span className="text-lg text-slate-300 group-hover:text-[#E8A23D]">↗</span></div>
                      {topic.subtopics.length > 0 ? <div className="mt-4 space-y-1.5">{topic.subtopics.slice(0, 3).map((subtopic) => <p key={subtopic} className="text-xs leading-5 text-slate-500">• {subtopic}</p>)}{topic.subtopics.length > 3 ? <p className="text-xs font-bold text-slate-400">+ {topic.subtopics.length - 3} more cardinal subtopics</p> : null}</div> : null}
                      <p className="mt-4 text-xs font-bold text-slate-400">Open topic workspace · teach with AI</p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
