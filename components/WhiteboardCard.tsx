type WhiteboardCardProps = {
  topic: string;
};

export default function WhiteboardCard({ topic }: WhiteboardCardProps) {
  return (
    <article className="relative min-h-[300px] overflow-hidden rounded-[1.75rem] border border-[#D9D3C5] bg-[#FBFAF7] p-6 shadow-[0_18px_50px_rgba(65,57,43,0.08)] sm:p-8">
      <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#E8A23D]/15 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9A5D00]">Live whiteboard</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#27231D]">{topic || 'Your lesson topic'}</h2>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E8D7B7] bg-[#FFF8E9] text-lg font-black text-[#9A5D00]" aria-hidden="true">Aa</span>
        </div>
        <div className="mt-8 rounded-2xl border border-dashed border-[#D9D3C5] bg-white/80 p-5">
          <p className="text-sm font-black text-[#514D45]">Your visual lesson is ready</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#8B8578]">As your tutor teaches, key concepts and explanations will appear here. Ask a question aloud to guide the board.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-hidden="true">
            <span className="h-2 rounded-full bg-[#E8A23D]/50" />
            <span className="h-2 rounded-full bg-[#D9D3C5]" />
            <span className="h-2 rounded-full bg-[#D9D3C5]" />
          </div>
        </div>
      </div>
    </article>
  );
}
