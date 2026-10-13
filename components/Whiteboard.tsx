type WhiteboardProps = {
  topic: string;
};

export default function Whiteboard({ topic }: WhiteboardProps) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#08111f] text-white">
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[#E8A23D]/10 blur-3xl" />
      <div className="relative flex h-full flex-col justify-center px-6 py-24 sm:px-12 lg:px-20">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E8A23D]">Live whiteboard · concept map</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.06em] sm:text-6xl">{topic || 'Your lesson topic'}</h1>
        <div className="mt-10 max-w-2xl rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-sm sm:p-8">
          <p className="text-base font-black text-white sm:text-lg">Your visual lesson is ready</p>
          <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">As your tutor teaches, key concepts and explanations will appear here. Ask a question aloud to guide the board.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3" aria-hidden="true">
            <span className="h-2 rounded-full bg-[#E8A23D]/80" />
            <span className="h-2 rounded-full bg-white/20" />
            <span className="h-2 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
