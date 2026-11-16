'use client';

type Props={microphoneActive:boolean;vadDetected:boolean;modelLatencyMs?:number|null;
  purgeStatus?:'idle'|'linking'|'teaching'|'cleaning'|'complete'|'error';onEnd:()=>void};
export default function ClassroomControls({microphoneActive,vadDetected,modelLatencyMs,purgeStatus='idle',onEnd}:Props){
  return <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2" aria-label="Classroom health and session controls">
    <span className={'rounded-full border px-2.5 py-1.5 text-[10px] font-bold '+(vadDetected?'border-emerald-400/40 text-emerald-200':'border-white/15 text-white/65')}
      role="status">
      {vadDetected?'Voice detected':microphoneActive?'Mic ready':'Press to talk'}
    </span>
    {modelLatencyMs!==null&&modelLatencyMs!==undefined&&<span className="rounded-full border border-white/15 px-2.5 py-1.5 text-[10px] tabular-nums text-white/65">
      Model TTFT {Math.round(modelLatencyMs)} ms
    </span>}
    {purgeStatus==='cleaning'&&<span className="text-[10px] font-bold text-amber-200">Erasing class files…</span>}
    {purgeStatus==='complete'&&<span className="text-[10px] font-bold text-emerald-200">Materials purged</span>}
    <button type="button" onClick={onEnd} className="rounded-lg border border-rose-400/30 bg-rose-900/70 px-3 py-2 text-xs font-bold text-white">
      End class
    </button>
  </div>;
}
