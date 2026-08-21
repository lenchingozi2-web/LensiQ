'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { checkBrowseAccess } from '../actions';

const banks = [
  { id: 'pathology', subject: 'Pathology', label: 'Pathology question bank', description: 'Anatomical Pathology, Chemical Pathology, Haematology / Immunology, and Microbiology divisions.', badge: '4 divisions', tone: 'gold' },
  { id: 'pharmacology', subject: 'Pharmacology', label: 'Pharmacology question bank', description: 'General, autonomic, antimicrobial, endocrine, CNS, cardiovascular, and clinical pharmacology.', badge: 'Systems and therapeutics', tone: 'blue' },
];

export default function BrowsePage() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubjectClick = async (subjectId: string, subjectName: string) => {
    setLoadingId(subjectId);
    setError('');
    try {
      const access = await checkBrowseAccess(subjectName);
      if (!access.allowed) { setError(access.message || 'This question bank is locked.'); setLoadingId(null); return; }
      router.push(`/browse/${subjectId}`);
    } catch { setError('Access could not be verified. Please try again.'); setLoadingId(null); }
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB] px-4 pb-16 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-6xl pt-8 sm:pt-12">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-sm font-black text-slate-500 hover:text-[#0B1220]">← Home</Link><div className="flex flex-wrap gap-2 text-xs font-black"><Link href="/curriculum" className="rounded-full bg-white px-3 py-2 text-slate-600 shadow-sm">Study path</Link><Link href="/search" className="rounded-full bg-white px-3 py-2 text-slate-600 shadow-sm">Search questions</Link><Link href="/exam" className="rounded-full bg-white px-3 py-2 text-slate-600 shadow-sm">Mock exam</Link></div></div>
        <section className="mt-8 rounded-[2rem] bg-[#0B1220] p-6 text-white shadow-xl sm:p-10"><p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">Practice bank</p><h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.05em] sm:text-5xl">Practise the questions that matter.</h1><p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">Choose a bank to browse by division and format. For a topic-first route, use the curriculum map or search the complete question bank.</p></section>
        {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
        <div className="mt-8 grid gap-5 md:grid-cols-2">{banks.map((bank) => <button key={bank.id} type="button" onClick={() => void handleSubjectClick(bank.id, bank.subject)} disabled={loadingId !== null} className={`group rounded-[2rem] border p-6 text-left shadow-sm hover:-translate-y-1 hover:shadow-xl sm:p-8 ${bank.tone === 'gold' ? 'border-amber-200 bg-[#FFF9EE]' : 'border-blue-100 bg-[#F5F8FF]'}`}><div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{bank.badge}</span><h2 className="mt-6 text-2xl font-black text-[#0B1220]">{loadingId === bank.id ? 'Checking access…' : bank.label}</h2><p className="mt-3 text-sm leading-7 text-slate-600">{bank.description}</p></div><span className="text-2xl text-slate-300 group-hover:translate-x-1">→</span></div><p className="mt-8 text-sm font-black text-[#9A5D00]">Open question bank →</p></button>)}</div>
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Need a narrower route?</p><h2 className="mt-2 text-xl font-black text-[#0B1220]">Start from a specific timetable topic.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">The curriculum map keeps each course and topic in context, then connects it to teaching and search.</p></div><Link href="/curriculum" className="rounded-xl bg-[#0B1220] px-5 py-3 text-center text-sm font-black text-white hover:bg-slate-800">Open curriculum</Link></div></div>
      </main>
    </div>
  );
}
