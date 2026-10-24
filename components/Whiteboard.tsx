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
    .slice(0, 6);
}

export default function Whiteboard({ topic, markdown, onConceptSelect }: WhiteboardProps) {
  const steps = useMemo(() => getConceptSteps(markdown ?? ''), [markdown]);
  const [activeStep, setActiveStep] = useState(0);
  const [slideKey, setSlideKey] = useState(0);
  const activeIndex = Math.min(activeStep, Math.max(steps.length - 1, 0));

  const chooseStep = (index: number) => {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    setActiveStep(next);
    setSlideKey((value) => value + 1);
    if (steps[next]) onConceptSelect?.(steps[next], next);
  };

  const step = steps[activeIndex] ?? 'Your tutor’s explanation will appear here when the first answer arrives.';

  return (
    <section className="relative isolate h-full w-full overflow-hidden bg-[#060a12] text-white" aria-label="Full-screen interactive medical concept whiteboard">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(232,162,61,0.22),transparent_28%),radial-gradient(circle_at_15%_80%,rgba(38,95,135,0.24),transparent_38%),linear-gradient(135deg,#0b1320,#05070c)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.26)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.26)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="pointer-events-none absolute -right-40 top-[12%] h-[38rem] w-[38rem] rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-20 top-[24%] h-[26rem] w-[26rem] rounded-full border border-[#e8a23d]/15" />

      <div key={slideKey} className="live-class-slide relative flex h-full min-h-[28rem] flex-col justify-center px-6 pb-[27dvh] pt-28 sm:px-12 sm:pb-[22dvh] lg:px-[10vw] lg:pt-32">
        <div className="max-w-7xl">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.28em] text-[#ffd68d] sm:text-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#e8a23d] shadow-[0_0_18px_rgba(232,162,61,.9)]" />
            Tutor visual board · {steps.length ? `${String(activeIndex + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}` : 'LIVE'}
          </div>
          <h1 className="mt-5 max-w-6xl text-4xl font-black leading-[0.98] tracking-[-0.065em] text-white sm:text-6xl lg:text-8xl">{topic || 'Your lesson topic'}</h1>
          <div className="my-8 h-px w-24 bg-[#e8a23d] shadow-[0_0_22px_rgba(232,162,61,.6)] sm:my-12 sm:w-40" />
          <article className="max-w-6xl text-2xl font-semibold leading-[1.2] tracking-[-0.03em] text-slate-100 sm:text-4xl lg:text-6xl">
            <ReactMarkdown components={{ p: ({ children }) => <p>{children}</p>, strong: ({ children }) => <strong className="font-black text-[#ffd68d]">{children}</strong> }}>
              {step}
            </ReactMarkdown>
          </article>
          {steps.length > 0 && <div className="mt-8 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => chooseStep(activeIndex - 1)} disabled={activeIndex === 0} className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-black text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35">← Previous</button>
            <button type="button" onClick={() => onConceptSelect?.(step, activeIndex)} className="rounded-xl border border-[#e8a23d]/40 bg-[#e8a23d]/10 px-4 py-2.5 text-xs font-black text-[#ffd68d] transition hover:bg-[#e8a23d]/20">Ask tutor about this</button>
            <button type="button" onClick={() => chooseStep(activeIndex + 1)} disabled={activeIndex >= steps.length - 1} className="rounded-xl bg-[#e8a23d] px-4 py-2.5 text-xs font-black text-[#101827] transition hover:bg-[#ffd68d] disabled:cursor-not-allowed disabled:opacity-35">Next →</button>
          </div>}
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-6 text-white/45 sm:text-base">Choose a point to focus the tutor on it. The board stays still until you navigate or the tutor changes the lesson.</p>
        </div>

        {steps.length > 1 && <div className="absolute bottom-[28dvh] left-6 flex max-w-[calc(100%-3rem)] gap-2 overflow-x-auto sm:bottom-[23dvh] sm:left-12 lg:left-[10vw]" aria-label="Automatic lesson progress">
          {steps.map((item, index) => <span key={`${index}-${item.slice(0, 18)}`} className={`h-2 rounded-full transition-all ${index === activeIndex ? 'w-16 bg-[#e8a23d] shadow-[0_0_18px_rgba(232,162,61,.8)]' : 'w-6 bg-white/25'}`} aria-hidden="true" />)}
        </div>}
      </div>
    </section>
  );
}
