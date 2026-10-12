'use client';

import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    if (steps.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveStep((current) => {
        const next = (current + 1) % steps.length;
        onConceptSelect?.(steps[next], next);
        setSlideKey((value) => value + 1);
        return next;
      });
    }, 5200);
    return () => window.clearInterval(timer);
  }, [onConceptSelect, steps]);

  const step = steps[activeIndex] ?? 'The tutor is preparing the next visual explanation.';

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
          <p className="mt-10 max-w-2xl text-sm font-semibold leading-6 text-white/45 sm:text-base">This board advances with the tutor. Tap a progress marker to revisit a point or interrupt the tutor to ask for a deeper explanation.</p>
        </div>

        {steps.length > 1 && <div className="absolute bottom-[28dvh] left-6 flex max-w-[calc(100%-3rem)] gap-2 overflow-x-auto sm:bottom-[23dvh] sm:left-12 lg:left-[10vw]">
          {steps.map((item, index) => <button key={`${index}-${item.slice(0, 18)}`} type="button" onClick={() => { setActiveStep(index); setSlideKey((value) => value + 1); onConceptSelect?.(item, index); }} className={`h-2 rounded-full transition-all ${index === activeIndex ? 'w-16 bg-[#e8a23d] shadow-[0_0_18px_rgba(232,162,61,.8)]' : 'w-6 bg-white/25 hover:bg-white/50'}`} aria-label={`Show concept point ${index + 1}`} aria-pressed={index === activeIndex} />)}
        </div>}
      </div>
    </section>
  );
}
