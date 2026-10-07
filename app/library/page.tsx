import Link from 'next/link';
import SlideBatchUploader from '@/components/library/SlideBatchUploader';

export default function LibraryPage() {
  return (
    <main className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB] px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl pt-8 sm:pt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A5D00]">Library</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-[#0B1220] sm:text-5xl">Build your medical knowledge base.</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">Keep lecture decks, past questions, and source material in one place so every Studio session can teach from the material that matters.</p>
          </div>
          <Link href="/studio" className="rounded-xl bg-[#0B1220] px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800">Open Studio</Link>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Slide batches</p><p className="mt-3 text-2xl font-black text-[#0B1220]">0</p><p className="mt-1 text-xs font-semibold text-slate-500">No processed batches yet</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Past questions</p><p className="mt-3 text-2xl font-black text-[#0B1220]">Ready</p><p className="mt-1 text-xs font-semibold text-slate-500">Your preserved question bank is available</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Studio context</p><p className="mt-3 text-2xl font-black text-[#0B1220]">Linked</p><p className="mt-1 text-xs font-semibold text-slate-500">Use library material in live lessons</p></div>
        </section>

        <div className="mt-6">
          <SlideBatchUploader />
        </div>
      </div>
    </main>
  );
}
