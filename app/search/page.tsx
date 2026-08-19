import Link from 'next/link';
import TopicDiscoveryPanel from '@/components/curriculum/TopicDiscoveryPanel';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const params = await searchParams;
  return (
    <div className="-mx-4 min-h-[calc(100vh-5rem)] bg-[#F7F8FC] px-4 pb-16">
      <section className="mx-auto max-w-5xl pt-8 sm:pt-12">
        <Link href="/curriculum" className="text-sm font-bold text-slate-500 hover:text-[#0B1220]">← Curriculum</Link>
        <div className="mt-6 rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">LenxiQ Discovery</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-[#0B1220] sm:text-5xl">Search the past-question universe.</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500">A single search surface for all five Year 4 branches. Type a word, paste a clinical concept, or attach lecture material to see the questions that connect to it.</p>
        </div>
        <TopicDiscoveryPanel courseSlug={params.course} />
      </section>
    </div>
  );
}
