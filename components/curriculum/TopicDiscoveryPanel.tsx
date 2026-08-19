'use client';

import Link from 'next/link';
import { useState } from 'react';

type SearchResult = {
  id: string;
  division: string | null;
  topic: string | null;
  type: string;
  year: number | null;
  question_text: string;
  image_url: string | null;
};

type Props = {
  courseSlug?: string;
  topicSlug?: string;
  topicTitle?: string;
};

const typeLabel: Record<string, string> = {
  mcq: 'MCQ',
  theory: 'Theory',
  practical: 'Practical',
};

export default function TopicDiscoveryPanel({ courseSlug, topicSlug, topicTitle }: Props) {
  const [query, setQuery] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [practicalLocked, setPracticalLocked] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!query.trim() && !file && !topicSlug) return;
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.set('query', query);
    if (courseSlug) formData.set('courseSlug', courseSlug);
    if (topicSlug) formData.set('topicSlug', topicSlug);
    if (file) formData.set('file', file);

    try {
      const response = await fetch('/api/curriculum/search', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Search could not be completed.');
      setResults(data.results ?? []);
      setTotalMatches(data.totalMatches ?? 0);
      setPracticalLocked(Boolean(data.practicalLocked));
      setSourceName(data.sourceName || '');
      setSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-7">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#E8A23D]">Connected question search</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-[#0B1220]">Find what matters in seconds</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Search a word, a clinical idea, or upload a lecture slide. LenxiQ matches the request against the preserved past-question bank.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">Exact source questions only</span>
      </div>

      <form onSubmit={runSearch} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 focus-within:border-[#E8A23D] focus-within:ring-4 focus-within:ring-[#E8A23D]/10">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={topicTitle ? `Search around ${topicTitle}…` : 'Try “acute inflammation”, “malaria”, or “beta blockers”…'} className="min-w-0 flex-1 rounded-xl border border-transparent bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-200" />
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:border-[#E8A23D] hover:text-[#0B1220]">
            <input type="file" className="sr-only" accept=".pdf,.ppt,.pptx,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            {file ? `Attached: ${file.name}` : 'Attach lecture slide'}
          </label>
          <button type="submit" disabled={loading || (!query.trim() && !file && !topicSlug)} className="rounded-xl bg-[#0B1220] px-6 py-3 text-sm font-black text-white transition-all hover:bg-slate-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'Searching…' : 'Find questions'}
          </button>
        </div>
      </form>

      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
      {sourceName && <p className="mt-4 text-xs font-semibold text-slate-400">Lecture source searched: {sourceName}</p>}

      {searched && !loading && (
        <div className="mt-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-[#0B1220]">{totalMatches} connected question{totalMatches === 1 ? '' : 's'} found</p>
            <span className="text-xs font-semibold text-slate-400">Ranked by text relevance</span>
          </div>
          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="font-bold text-slate-700">No close matches yet.</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Try a shorter clinical term or upload a clearer lecture document.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => (
                <article key={result.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:border-slate-300 hover:bg-white">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em]">
                    <span className="rounded-full bg-[#E8A23D]/15 px-2.5 py-1 text-[#9A5D00]">{typeLabel[result.type] || result.type}</span>
                    <span className="text-slate-400">Match {index + 1}</span>
                    {result.year && <span className="text-slate-400">{result.year}</span>}
                  </div>
                  <p className="text-sm font-bold leading-6 text-[#0B1220]">{result.question_text}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">{[result.division, result.topic].filter(Boolean).join(' · ') || 'Course question bank'}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {practicalLocked && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-amber-950">Some practical matches are premium-only.</p>
            <p className="mt-1 text-sm leading-6 text-amber-900/70">Upgrade to unlock specimen images and the full practical question set.</p>
          </div>
          <Link href="/pricing" className="rounded-xl bg-[#0B1220] px-5 py-3 text-center text-sm font-black text-white hover:bg-slate-700">View plans</Link>
        </div>
      )}
    </section>
  );
}
