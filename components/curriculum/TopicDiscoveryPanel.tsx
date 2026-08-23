'use client';

import Link from 'next/link';
import { useState } from 'react';
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client';

type SearchResult = {
  id: string;
  subject: string;
  division: string | null;
  topic: string | null;
  type: string;
  year: number | null;
  question_text: string;
  image_url: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  correct_answer: string | null;
  model_answer: string | null;
  relevance: number;
};

type Props = { courseSlug?: string; topicSlug?: string; topicTitle?: string };

const typeLabel: Record<string, string> = { mcq: 'MCQ', theory: 'Theory', practical: 'Practical' };
const optionLabels = ['A', 'B', 'C', 'D', 'E'] as const;

function ResultCard({ result, index }: { result: SearchResult; index: number }) {
  const options = [result.option_a, result.option_b, result.option_c, result.option_d, result.option_e];
  const hasOptions = result.type === 'mcq' && options.some(Boolean);
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
          <span className="rounded-full bg-[#E8A23D]/20 px-2.5 py-1 text-[#8B5709]">{typeLabel[result.type] || result.type}</span>
          <span className="text-slate-400">Match {index + 1}</span>
          {result.year && <span className="text-slate-400">{result.year}</span>}
        </div>
        <span className="text-xs font-bold text-slate-400">{result.relevance > 0.7 ? 'Strong match' : 'Related match'}</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-base font-black leading-7 text-[#0B1220]">{result.question_text}</p>
        {hasOptions && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {options.map((option, optionIndex) => option ? (
              <div key={`${result.id}-${optionLabels[optionIndex]}`} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-[#9A5D00] shadow-sm">{optionLabels[optionIndex]}</span>
                <span>{option}</span>
              </div>
            ) : null)}
          </div>
        )}
        {result.image_url && <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">This question has an attached practical image. Open the practice bank for the premium image view.</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-bold text-slate-400">{[result.subject, result.division, result.topic].filter(Boolean).join(' · ') || 'LenxiQ AI question bank'}</p>
          {result.type === 'mcq' && <span className="text-xs font-black text-slate-500">{options.filter(Boolean).length} options shown</span>}
        </div>
      </div>
    </article>
  );
}

export default function TopicDiscoveryPanel({ courseSlug, topicSlug, topicTitle }: Props) {
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [practicalLocked, setPracticalLocked] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!query.trim() && !file && !topicSlug) return;
    setLoading(true);
    setError('');
    let temporaryStoragePath: string | null = null;
    try {
      let response: Response;
      if (file) {
        const prepareResponse = await fetch('/api/uploads/lecture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'search', fileName: file.name, mimeType: file.type || 'application/octet-stream', sizeBytes: file.size }) });
        const uploadData = await prepareResponse.json().catch(() => ({}));
        if (!prepareResponse.ok) throw new Error(uploadData.error || 'The lecture upload could not be prepared.');
        temporaryStoragePath = typeof uploadData.path === 'string' ? uploadData.path : null;
        const supabase = createBrowserSupabaseClient();
        const { error: uploadError } = await supabase.storage.from(uploadData.bucket).uploadToSignedUrl(uploadData.path, uploadData.token, file, { contentType: file.type || uploadData.mimeType });
        if (uploadError) throw new Error('The lecture upload could not be completed. Please try again.');
        response = await fetch('/api/curriculum/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim(), courseSlug, topicSlug, storagePath: uploadData.path, fileName: file.name, mimeType: file.type || uploadData.mimeType, sizeBytes: file.size }) });
      } else {
        const formData = new FormData();
        formData.set('query', query.trim());
        if (courseSlug) formData.set('courseSlug', courseSlug);
        if (topicSlug) formData.set('topicSlug', topicSlug);
        response = await fetch('/api/curriculum/search', { method: 'POST', body: formData });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Search could not be completed.');
      setResults(data.results ?? []);
      setTotalMatches(data.totalMatches ?? 0);
      setPracticalLocked(Boolean(data.practicalLocked));
      setSourceName(data.sourceName || '');
      setSearchedQuery(data.query || query.trim() || topicTitle || file?.name || 'your search');
      setSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search could not be completed.');
    } finally {
      if (temporaryStoragePath) {
        await fetch('/api/uploads/lecture', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storagePath: temporaryStoragePath }) }).catch(() => undefined);
      }
      setLoading(false);
    }
  };

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.07)] sm:mt-10">
      <div className="border-b border-slate-200 bg-[#0B1220] p-5 text-white sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#E8A23D]">Question discovery</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Find the closest preserved questions.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Search a focused concept or upload a lecture document. Results are ranked against the question stem, course, division, and topic—not broad answer text.</p></div>
          <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-slate-200">Exact and close matches</span>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <form onSubmit={runSearch} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 focus-within:border-[#E8A23D] focus-within:ring-4 focus-within:ring-[#E8A23D]/10">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={topicTitle ? `Search within ${topicTitle}…` : 'Try “inflammation”, “malaria”, or “beta blockers”'} className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#E8A23D]" />
            <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 hover:border-[#E8A23D] hover:text-[#0B1220]"><input type="file" className="sr-only" accept=".pdf,.pptx,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />{file ? `Attached: ${file.name}` : 'Attach lecture slide'}</label>
            <button type="submit" disabled={loading || (!query.trim() && !file && !topicSlug)} className="min-h-12 rounded-xl bg-[#E8A23D] px-6 py-3 text-sm font-black text-[#0B1220] shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Searching…' : 'Find questions'}</button>
          </div>
        </form>
        {file && <p className="mt-3 text-xs font-bold text-slate-500">Lecture matching is active for <span className="text-slate-800">{file.name}</span>. Type a query as well if you want to narrow the upload results.</p>}
        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}

        {searched && !loading && (
          <div className="mt-8">
            <div className="mb-5 flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Results for</p><h3 className="mt-1 text-xl font-black text-[#0B1220]">{searchedQuery}</h3></div><p className="text-sm font-bold text-slate-500">{totalMatches} close match{totalMatches === 1 ? '' : 'es'}</p></div>
            {sourceName && <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-xs font-bold text-blue-900">Lecture source analysed: {sourceName}</p>}
            {results.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><p className="font-black text-slate-800">No sufficiently close matches.</p><p className="mt-2 text-sm leading-6 text-slate-500">Try the central clinical term, remove extra words, or upload a clearer lecture document. LenxiQ AI will not pad the list with loosely related questions.</p></div> : <div className="space-y-4">{results.map((result, index) => <ResultCard key={result.id} result={result} index={index} />)}</div>}
          </div>
        )}

        {practicalLocked && <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-amber-950">Some practical matches are locked.</p><p className="mt-1 text-sm leading-6 text-amber-900/70">One Anatomical Pathology organ/system is available on the free plan. Upgrade to unlock the other organ systems, specimen images, and the complete practical bank.</p></div><Link href="/pricing" className="rounded-xl bg-[#0B1220] px-5 py-3 text-center text-sm font-black text-white hover:bg-slate-700">View plans</Link></div>}
      </div>
    </section>
  );
}
