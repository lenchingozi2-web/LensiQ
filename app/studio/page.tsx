'use client';

import { useEffect, useState } from 'react';

type Scene = { scene_number: number; narration: string; search_queries: string[] };
type Video = { id: string; title: string; description: string; bgm_query: string; scenes: Scene[]; status: string; created_at: string };

const starter = 'Create a 60-second vertical short explaining how AI is changing diagnosis in modern healthcare. Make it practical, balanced, and compelling for medical students.';

export default function StudioPage() {
  const [prompt, setPrompt] = useState(starter);
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadVideos = async () => {
    const response = await fetch('/api/studio/videos', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    setVideos(data.videos ?? []);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadVideos(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const generate = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/studio/videos/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed.');
      setSelected(data.video); setNotice('Plan generated and saved as pending.'); await loadVideos();
    } catch (e) { setError(e instanceof Error ? e.message : 'Generation failed.'); }
    finally { setBusy(false); }
  };
  const render = async (video: Video) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/studio/videos/${video.id}/render`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start rendering.');
      const updated = { ...video, status: 'rendering' };
      setSelected(updated); setVideos((current) => current.map((item) => item.id === video.id ? updated : item)); setNotice('Rendering queued. Start worker.py locally or from GitHub Actions to process it.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start rendering.'); }
    finally { setBusy(false); }
  };

  return <div className="min-h-[calc(100vh-4.5rem)] bg-[#f6f8fb] px-5 py-10 sm:px-8 lg:px-12">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#0f766e]">LenxiQ Studio</p><h1 className="mt-3 text-4xl font-black tracking-tight text-[#0b1220]">Turn one idea into a ready-to-render short.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Gemini creates a strict scene plan. The zero-cost worker handles voice, footage, captions, FFmpeg rendering, and private YouTube upload.</p></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-800">Frontend live · Worker local/GitHub Actions</div></div>
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><label className="text-sm font-black text-[#0b1220]" htmlFor="prompt">Video brief</label><textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} className="mt-3 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800 outline-none ring-[#e8a23d] focus:ring-2" placeholder="Describe the short you want to make…" /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-400">Gemini 2.5 Flash · JSON schema enforced · 4–8 scenes</span><button type="button" onClick={() => void generate()} disabled={busy || prompt.trim().length < 8} className="rounded-xl bg-[#0b1220] px-5 py-3 text-sm font-black text-white hover:bg-[#0f766e] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Working…' : 'Generate plan'}</button></div>{error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</p>}</section>
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black">Video queue</h2><button type="button" onClick={() => void loadVideos()} className="text-xs font-black text-[#0f766e]">Refresh</button></div><div className="mt-4 space-y-3">{videos.length === 0 ? <p className="rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">No video plans yet. Generate your first one above.</p> : videos.map((video) => <button type="button" key={video.id} onClick={() => setSelected(video)} className={`w-full rounded-2xl border p-4 text-left ${selected?.id === video.id ? 'border-[#0f766e] bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'}`}><div className="flex items-start justify-between gap-3"><span className="line-clamp-2 text-sm font-black text-slate-800">{video.title}</span><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500">{video.status}</span></div><p className="mt-2 text-xs text-slate-400">{video.scenes?.length ?? 0} scenes · {new Date(video.created_at).toLocaleDateString()}</p></button>)}</div></section>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">{selected ? <><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Selected plan</p><h2 className="mt-2 text-2xl font-black text-[#0b1220]">{selected.title}</h2></div>{selected.status === 'pending' && <button type="button" onClick={() => void render(selected)} disabled={busy} className="rounded-xl bg-[#e8a23d] px-4 py-3 text-sm font-black text-[#0b1220] hover:bg-[#f1b962] disabled:opacity-50">Render video</button>}</div><p className="mt-4 text-sm leading-6 text-slate-600">{selected.description}</p><p className="mt-4 rounded-xl bg-purple-50 px-4 py-3 text-xs font-bold text-purple-800">BGM search: {selected.bgm_query}</p><div className="mt-6 space-y-3">{selected.scenes?.map((scene) => <article key={scene.scene_number} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#0f766e]">Scene {scene.scene_number}</h3><span className="text-[11px] font-bold text-slate-400">{scene.search_queries.join(' · ')}</span></div><p className="mt-2 text-sm leading-6 text-slate-700">{scene.narration}</p></article>)}</div></> : <div className="flex min-h-[360px] items-center justify-center rounded-2xl bg-slate-50 p-8 text-center"><div><p className="text-lg font-black text-slate-700">Your scene plan will appear here.</p><p className="mt-2 text-sm text-slate-500">Generate a plan, review it, then hand it to the local renderer.</p></div></div>}</section></div>
    </div>
  </div>;
}
