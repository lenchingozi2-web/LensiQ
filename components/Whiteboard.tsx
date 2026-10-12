import ReactMarkdown from 'react-markdown';
type WhiteboardProps = {
  topic: string;
  markdown?: string;
};

export default function Whiteboard({ topic, markdown }: WhiteboardProps) {
  return (
    <div className="relative isolate h-full w-full overflow-hidden bg-[#09111f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_25%,rgba(232,162,61,0.18),transparent_28%),radial-gradient(circle_at_24%_78%,rgba(41,95,132,0.22),transparent_36%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.25)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="absolute -right-36 top-1/4 h-[32rem] w-[32rem] rounded-full border border-white/10" aria-hidden="true" />
      <div className="absolute -right-20 top-[30%] h-[24rem] w-[24rem] rounded-full border border-[#e8a23d]/15" aria-hidden="true" />
      <div className="relative flex h-full min-h-[28rem] flex-col justify-center px-6 pb-32 pt-28 sm:px-12 lg:px-20">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#e8a23d]/25 bg-[#e8a23d]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-[#ffd68d]"><span className="h-1.5 w-1.5 rounded-full bg-[#e8a23d] shadow-[0_0_14px_rgba(232,162,61,0.9)]" /> Visual classroom · ready</p>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">{topic || 'Your lesson topic'}</h1>
          {markdown ? <article className="mt-7 max-w-3xl rounded-3xl border border-white/10 bg-[#101827]/70 p-5 shadow-2xl backdrop-blur-xl sm:p-7"><p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-[#e8a23d]">Tutor’s live concept board</p><div className="prose prose-invert max-w-none prose-headings:tracking-tight prose-strong:text-[#ffd68d] prose-li:marker:text-[#e8a23d]"><ReactMarkdown>{markdown}</ReactMarkdown></div></article> : <><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Your tutor stages the visual that best matches the concept being taught: anatomy, clinical media, or a live concept board.</p><div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#e8a23d]">01</span><p className="mt-2 text-sm font-bold text-white">See the structure</p><p className="mt-1 text-xs leading-5 text-slate-400">Explore anatomy as the tutor explains.</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#e8a23d]">02</span><p className="mt-2 text-sm font-bold text-white">Ask naturally</p><p className="mt-1 text-xs leading-5 text-slate-400">Interrupt, clarify, or change focus aloud.</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#e8a23d]">03</span><p className="mt-2 text-sm font-bold text-white">Keep the lesson</p><p className="mt-1 text-xs leading-5 text-slate-400">Review it in class history.</p></div></div></>}
        </div>
      </div>
    </div>
  );
}
