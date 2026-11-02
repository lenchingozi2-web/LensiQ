'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type WhiteboardProps = {
  topic: string;
  markdown?: string;
  onConceptSelect?: (concept: string, index: number) => void;
};

function conceptSteps(markdown: string): string[] {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\`([^\`]+)\`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/\*\*|__/g, '')
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 18 && !/^(?:the tutor's explanation|live teaching|lesson progress)$/i.test(part))
    .slice(-12);
}

export default function Whiteboard({ topic, markdown, onConceptSelect }: WhiteboardProps) {
  const steps = useMemo(() => conceptSteps(markdown ?? ''), [markdown]);
  const [selected, setSelected] = useState(0);
  const [followTutor, setFollowTutor] = useState(true);
  // Spoken explanations are focused by default. A diagram is shown only for
  // explicit mechanism/flow content, or when the learner requests Flow.
  const [mapMode, setMapMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const active = Math.max(0, Math.min(selected, steps.length - 1));
  const diagramSource = /(?:→|➡|\s->\s|^\s*(?:flowchart|mechanism flow|pathway)\s*:)/im.test(markdown ?? '');
  const diagramMode = mapMode || diagramSource;
  const diagramStart = Math.max(0, active - 3);
  const diagramSteps = steps.slice(diagramStart, Math.min(steps.length, active + 2));
  useEffect(() => {
    if (followTutor && steps.length) setSelected(steps.length - 1);
  }, [steps.length, markdown, followTutor]);
  useEffect(() => {
    if (!followTutor || !diagramMode || steps.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const nodes = viewportRef.current?.querySelectorAll('[data-lesson-step]');
      nodes?.[nodes.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [steps.length, followTutor, diagramMode]);

  function choose(index: number) {
    const next = Math.max(0, Math.min(index, steps.length - 1));
    setFollowTutor(false);
    setSelected(next);
    if (steps[next]) onConceptSelect?.(steps[next], next);
  }

  return (
    <section className="relative h-full w-full overflow-hidden bg-[#070e18] text-white" aria-label="Interactive medical teaching board">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(#ffffff0b_1px,transparent_1px),linear-gradient(90deg,#ffffff0b_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 border-b border-white/10 bg-[#0b1422]/85 px-3 pb-2 pt-[4.8rem] backdrop-blur-lg sm:px-6 sm:pt-24">
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ffd080]">Live concept board</p><h1 className="truncate text-sm font-bold text-white sm:text-xl">{topic || 'Medical lesson'}</h1></div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setMapMode((value) => !value)} className="rounded-lg border border-white/15 px-2.5 py-2 text-[11px] font-semibold text-white/90" aria-pressed={diagramMode}>{diagramMode ? 'Focus' : 'Flow'}</button>
          <button type="button" onClick={() => setZoom((z) => Math.max(.8, +(z-.1).toFixed(1)))} aria-label="Zoom out" className="rounded-lg border border-white/15 px-2.5 py-2 text-sm">−</button>
          <button type="button" onClick={() => setZoom((z) => Math.min(1.4, +(z+.1).toFixed(1)))} aria-label="Zoom in" className="rounded-lg border border-white/15 px-2.5 py-2 text-sm">+</button>
        </div>
      </div>
      <div ref={viewportRef} className="absolute inset-x-0 bottom-[5.5rem] top-[8.7rem] overflow-y-auto overscroll-contain px-3 py-5 sm:top-32 sm:bottom-24 sm:px-8" style={{ touchAction: 'pan-y' }}>
        {steps.length === 0 ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e8a23d]/35 bg-[#e8a23d]/10 text-3xl text-[#ffd080]">✦</div>
            <h2 className="text-xl font-bold sm:text-3xl">{topic || 'Ready to explore'}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/60">As the tutor explains the first concept, its steps and relationships will build here. You can tap any step to discuss it.</p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl origin-top transition-transform duration-200" style={{ zoom }}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-white/60">{diagramMode ? 'Current mechanism · tap a step' : 'Live explanation · one point at a time'}</p>
              {!followTutor && <button type="button" onClick={() => { setFollowTutor(true); setSelected(steps.length - 1); }} className="rounded-full border border-[#e8a23d]/40 bg-[#e8a23d]/15 px-3 py-1.5 text-[11px] font-bold text-[#ffd080]">Follow tutor ↗</button>}
            </div>
            {diagramMode ? (
              <div className="flex flex-col items-stretch" aria-label="Interactive causal flow for the current concept">
                {diagramSteps.map((step, localIndex) => {
                  const index = diagramStart + localIndex;
                  return <div key={index} className="flex flex-col items-center">
                  <button type="button" data-lesson-step onClick={() => choose(index)} aria-current={active === index ? 'step' : undefined} className={`w-full rounded-2xl border px-4 py-4 text-left shadow-lg transition sm:px-6 ${active === index ? 'border-[#e8a23d] bg-[#e8a23d]/15 shadow-[#e8a23d]/10' : 'border-white/15 bg-[#142235]/85 hover:border-white/35'}`}>
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[.14em] text-[#ffd080]">Concept {String(index + 1).padStart(2, '0')}{active === index && followTutor ? ' · now teaching' : ''}</span>
                    <span className="block text-sm font-semibold leading-6 text-white/95 sm:text-lg sm:leading-7">{step}</span>
                  </button>
                  {localIndex < diagramSteps.length - 1 && <div aria-hidden="true" className="flex h-9 flex-col items-center"><div className="h-5 w-px bg-[#e8a23d]/50" /><span className="-mt-1 text-base text-[#e8a23d]/75">↓</span></div>}
                </div>)}
              </div>
            ) : (
              <div key={active} className="animate-[lab-reveal_400ms_ease-out] rounded-2xl border border-[#e8a23d]/35 bg-[#142235] p-5 shadow-xl sm:p-9">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ffd080]">Now teaching · {active + 1} / {steps.length}</p>
                <p className="mt-4 text-xl font-semibold leading-8 sm:text-3xl sm:leading-[1.4]">{steps[active]}</p>
                <p className="mt-5 text-xs text-white/50">Swipe the lesson forward with Next or tap Flow to explore the current mechanism.</p>
                <button type="button" onClick={() => choose(active)} className="mt-5 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/80">Ask tutor about this</button>
              </div>
            )}
          </div>
        )}
      </div>
      {steps.length > 0 && <nav aria-label="Concept navigation" className="absolute bottom-[4.7rem] left-3 right-3 z-10 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0b1422]/90 p-2 backdrop-blur-xl sm:bottom-20 sm:left-8 sm:right-8">
        <button type="button" onClick={() => choose(active - 1)} disabled={active === 0} className="rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-30">← Previous</button>
        <span className="text-xs font-semibold tabular-nums text-white/55">{active + 1} / {steps.length}</span>
        <button type="button" onClick={() => choose(active + 1)} disabled={active === steps.length - 1} className="rounded-lg bg-[#e8a23d] px-4 py-2 text-xs font-bold text-[#0b1422] disabled:opacity-30">Next →</button>
      </nav>}
    </section>
  );
}
