type WhiteboardProps = {
  topic: string;
};

export default function Whiteboard({ topic }: WhiteboardProps) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#FBFAF7] text-[#27231D]">
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#E8A23D]/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[#D9E4E8]/60 blur-3xl" />
      <div className="relative flex h-full flex-col justify-center px-6 py-24 sm:px-12 lg:px-20">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A5D00]">Live whiteboard</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.06em] sm:text-6xl">{topic || 'Your lesson topic'}</h1>
        <div className="mt-10 max-w-2xl rounded-3xl border border-dashed border-[#D9D3C5] bg-white/75 p-6 shadow-[0_18px_50px_rgba(65,57,43,0.08)] backdrop-blur-sm sm:p-8">
          <p className="text-base font-black text-[#514D45] sm:text-lg">Your visual lesson is ready</p>
          <p className="mt-3 text-sm leading-7 text-[#8B8578] sm:text-base">As your tutor teaches, key concepts and explanations will appear here. Ask a question aloud to guide the board.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3" aria-hidden="true">
            <span className="h-2 rounded-full bg-[#E8A23D]/60" />
            <span className="h-2 rounded-full bg-[#D9D3C5]" />
            <span className="h-2 rounded-full bg-[#D9D3C5]" />
          </div>
        </div>
      </div>
    </div>
  );
}
