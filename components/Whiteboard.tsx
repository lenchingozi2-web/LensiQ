'use client';

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

type WhiteboardProps = {
  topic: string;
  markdown?: string;
  onConceptSelect?: (concept: string, index: number) => void;
};

function getConceptSteps(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/\*\*|__/g, '')
    .split(/\n+|(?<=[.!?])\s+/)
    .map((step) => step.replace(/^\s*\d+[.)]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((step) => step.length > 12 && !/^the tutor's explanation$/i.test(step))
    .slice(0, 5);
}

export default function Whiteboard({ topic, markdown, onConceptSelect }: WhiteboardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [zoom, setZoom] = useState(1);
  const steps = useMemo(() => getConceptSteps(markdown ?? ''), [markdown]);
  const activeIndex = Math.min(activeStep, Math.max(steps.length - 1, 0));

  return (
    <section className="relative isolate h-full w-full overflow-hidden bg-[#080d16] text-white" aria-label="Interactive medical concept whiteboard">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_24%,rgba(232,162,61,0.17),transparent_28%),radial-gradient(circle_at_20%_76%,rgba(41,95,132,0.22),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute -right-32 top-[18%] h-[30rem] w-[30rem] rounded-full border border-white/10" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-12 top-[27%] h-[21rem] w-[21rem] rounded-full border border-[#e8a23d]/15" aria-hidden="true" />

      <div className="relative flex h-full min-h-[28rem] flex-col overflow-y-auto px-4 pb-[31dvh] pt-24 sm:px-8 sm:pt-28 lg:px-12">
        <header className="flex w-full items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#e8a23d]/25 bg-[#e8a23d]/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#ffd68d] sm:text-[10px]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e8a23d] shadow-[0_0_14px_rgba(232,162,61,0.9)]" />
              Live concept board
            </p>
            <h1 className="mt-3 max-w-4xl text-2xl font-black tracking-[-0.05em] text-white sm:text-4xl lg:text-5xl">{topic || 'Your lesson topic'}</h1>
          </div>
          {markdown && (
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-[#101827]/80 p-1 backdrop-blur-xl" aria-label="Whiteboard zoom controls">
              <button type="button" onClick={() => setZoom((current) => Math.max(0.85, Number((current - 0.1).toFixed(2))))} className="h-9 w-9 rounded-lg text-lg font-bold text-white/75 hover:bg-white/10" aria-label="Zoom out">−</button>
              <span className="min-w-10 text-center text-[10px] font-black tabular-nums text-white/55">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((current) => Math.min(1.2, Number((current + 0.1).toFixed(2))))} className="h-9 w-9 rounded-lg text-lg font-bold text-white/75 hover:bg-white/10" aria-label="Zoom in">+</button>
            </div>
          )}
        </header>

        {markdown ? (
          <div className="mt-5 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
            <main className="min-w-0 rounded-[1.5rem] border border-white/10 bg-[#101827]/70 p-4 shadow-[0_30px_90px_rgba(0,0,0,.35)] backdrop-blur-xl sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#e8a23d]">Tutor&apos;s visual notes</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">Select a point to focus it. These cards follow the tutor&apos;s spoken sequence.</p>
                </div>
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">{steps.length} focus point{steps.length === 1 ? '' : 's'}</p>
              </div>

              {steps.length > 0 ? (
                <div className={`mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3 ${zoom > 1.05 ? 'text-base' : zoom < 0.95 ? 'text-xs' : 'text-sm'}`}>
                  {steps.map((step, index) => (
                    <button
                      key={`${index}-${step.slice(0, 24)}`}
                      type="button"
                      onClick={() => { setActiveStep(index); onConceptSelect?.(step, index); }}
                      className={`group relative min-h-24 rounded-2xl border p-4 text-left transition ${activeIndex === index ? 'border-[#e8a23d]/60 bg-[#e8a23d]/10 shadow-[0_0_30px_rgba(232,162,61,.1)]' : 'border-white/10 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.06]'}`}
                      aria-pressed={activeIndex === index}
                    >
                      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#e8a23d]">Point {String(index + 1).padStart(2, '0')}</span>
                      <span className="mt-2 block leading-6 text-slate-100">{step.length > 180 ? `${step.slice(0, 177).trimEnd()}…` : step}</span>
                      <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#e8a23d] opacity-0 transition group-hover:opacity-80" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-5 text-sm leading-7 text-slate-400">The tutor&apos;s next explanation will be mapped here as a visual concept sequence.</div>
              )}

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#080d16]/75 p-4 sm:p-5">
                {steps.length > 0 && <p className="mb-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#ffd68d]">Focused explanation · {String(activeIndex + 1).padStart(2, '0')}</p>}
                <article className="prose prose-invert max-w-none text-sm leading-7 prose-headings:tracking-tight prose-strong:text-[#ffd68d] prose-li:marker:text-[#e8a23d] prose-p:my-2 prose-li:my-1 sm:text-base">
                  <ReactMarkdown>{steps.length > 0 ? `### Focus point ${activeIndex + 1}\n\n${steps[activeIndex]}` : markdown}</ReactMarkdown>
                </article>
              </div>
            </main>

            <aside className="hidden rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl xl:block">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#e8a23d]">Explore the model</p>
              <h2 className="mt-3 text-lg font-black tracking-tight text-white">Make the idea yours</h2>
              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-white/10 bg-black/15 p-3"><p className="text-xs font-bold text-white">01 · Focus</p><p className="mt-1 text-[11px] leading-5 text-slate-400">Tap a card to isolate that part of the explanation.</p></div>
                <div className="rounded-xl border border-white/10 bg-black/15 p-3"><p className="text-xs font-bold text-white">02 · Revisit</p><p className="mt-1 text-[11px] leading-5 text-slate-400">Zoom the board and use the transcript when you want the exact wording.</p></div>
                <div className="rounded-xl border border-white/10 bg-black/15 p-3"><p className="text-xs font-bold text-white">03 · Ask</p><p className="mt-1 text-[11px] leading-5 text-slate-400">Interrupt the tutor and ask it to unpack any highlighted step.</p></div>
              </div>
              <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">Synced to the latest tutor turn</p>
            </aside>
          </div>
        ) : (
          <div className="mt-6 grid max-w-5xl gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl sm:p-5"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#e8a23d]">01 · Anatomy</span><p className="mt-2 text-sm font-bold text-white">See the structure</p><p className="mt-1 text-xs leading-5 text-slate-400">Rotate and zoom a 3D organ model while the tutor explains it.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl sm:p-5"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#e8a23d]">02 · Mechanism</span><p className="mt-2 text-sm font-bold text-white">Map the concept</p><p className="mt-1 text-xs leading-5 text-slate-400">The whiteboard builds from the tutor&apos;s live explanation.</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl sm:p-5"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#e8a23d]">03 · Physiology</span><p className="mt-2 text-sm font-bold text-white">Change a variable</p><p className="mt-1 text-xs leading-5 text-slate-400">Manipulate the simulation and observe the model respond.</p></div>
          </div>
        )}
      </div>
    </section>
  );
}
