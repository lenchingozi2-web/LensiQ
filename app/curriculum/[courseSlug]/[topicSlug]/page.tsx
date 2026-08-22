import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurriculumTopic } from '@/lib/curriculum';
import TopicDiscoveryPanel from '@/components/curriculum/TopicDiscoveryPanel';

export const dynamic = 'force-dynamic';

export default async function TopicWorkspacePage({ params }: { params: Promise<{ courseSlug: string; topicSlug: string }> }) {
  const { courseSlug, topicSlug } = await params;
  const supabase = await createClient();
  const { course, topic } = await getCurriculumTopic(supabase, courseSlug, topicSlug);
  if (!course || !topic) notFound();

  return (
    <div className="-mx-4 min-h-[calc(100vh-5rem)] bg-[#F7F8FC] px-4 pb-16">
      <section className="mx-auto max-w-5xl pt-8 sm:pt-12">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500"><Link href={`/curriculum/${course.slug}`} className="hover:text-[#0B1220]">{course.name}</Link><span>›</span><span className="text-slate-400">Day {topic.day_number}</span></div>
        <div className="mt-6 overflow-hidden rounded-[2.5rem] bg-[#0B1220] p-6 text-white shadow-[0_25px_80px_rgba(11,18,32,0.22)] sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">{topic.day_title}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">{topic.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">This is your focused workspace for {topic.title}. Start with a grounded explanation, then search the preserved question bank for the way this topic appears in examinations.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={`/teach?course=${encodeURIComponent(course.name)}&topic=${encodeURIComponent(topic.title)}`} className="rounded-xl bg-[#E8A23D] px-5 py-3 text-center text-sm font-black text-[#0B1220] hover:bg-amber-400">Start AI teaching</Link>
            <Link href={`/curriculum/${course.slug}`} className="rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-black text-white hover:bg-white/10">Back to pathway</Link>
          </div>
        </div>

        {topic.subtopics.length > 0 ? <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#E8A23D]">Cardinal subtopics</p><h2 className="mt-2 text-2xl font-black text-[#0B1220]">What this topic covers</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{topic.subtopics.map((subtopic) => <div key={subtopic} className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{subtopic}</div>)}</div></section> : null}

        <TopicDiscoveryPanel courseSlug={course.slug} topicSlug={topic.slug} topicTitle={topic.title} />
      </section>
    </div>
  );
}
