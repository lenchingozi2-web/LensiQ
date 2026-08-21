import Link from 'next/link';
import TopicDiscoveryPanel from '@/components/curriculum/TopicDiscoveryPanel';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const params = await searchParams;
  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB] px-4 pb-16 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl pt-8 sm:pt-12">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-sm font-black text-slate-500 hover:text-[#0B1220]">← Home</Link><div className="flex flex-wrap gap-2 text-xs font-black"><Link href="/curriculum" className="rounded-full bg-white px-3 py-2 text-slate-600 shadow-sm hover:text-[#0B1220]">Study path</Link><Link href="/browse" className="rounded-full bg-white px-3 py-2 text-slate-600 shadow-sm hover:text-[#0B1220]">Question bank</Link><Link href="/voice" className="rounded-full bg-white px-3 py-2 text-slate-600 shadow-sm hover:text-[#0B1220]">Voice Tutor</Link></div></div>
        <div className="mt-8 grid gap-6 rounded-[2rem] bg-[#0B1220] p-6 text-white shadow-xl sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">LenxiQ AI discovery</p><h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.05em] sm:text-5xl">Search the question bank with precision.</h1><p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">Type the central clinical concept or upload a lecture document. Results are matched against the preserved question stem, course, division, and topic, then shown with the complete MCQ options.</p></div><div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm font-bold text-slate-200"><p className="text-[#E8A23D]">Search principle</p><p className="mt-2 max-w-xs leading-6">A short, specific term usually gives the cleanest result set. LenxiQ AI will not pad results with unrelated answer text.</p></div></div>
        <TopicDiscoveryPanel courseSlug={params.course} />
      </section>
    </div>
  );
}
