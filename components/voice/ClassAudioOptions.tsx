'use client';
export default function ClassAudioOptions({pace,onPaceChange,muted,blocked,onSound,pressToTalk,onMode,voiceMode,onVoiceMode}:{pace:number;onPaceChange:(value:number)=>void;muted:boolean;blocked:boolean;onSound:()=>void;pressToTalk:boolean;onMode:()=>void;voiceMode?:'max_hours'|'studio_clarity';onVoiceMode?:(value:'max_hours'|'studio_clarity')=>void}){
  return <details className="relative">
    <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-white/15 bg-white/10 px-3 text-[11px] font-bold">{blocked?'Enable sound':muted?'Audio off':'Voice & pace'}</summary>
    <div className="absolute bottom-12 right-0 w-64 rounded-2xl border border-white/20 bg-[#101d30] p-4 text-sm shadow-2xl">
      <label className="flex justify-between gap-2 font-bold" htmlFor="class-pace">Teaching pace <output>{pace.toFixed(2)}×</output></label>
      <input id="class-pace" aria-label="Teaching pace" type="range" min="0.8" max="1.15" step="0.01" value={pace} onChange={e=>onPaceChange(Number(e.target.value))} className="mt-3 w-full accent-amber-300"/>
      <div className="flex justify-between text-xs text-white/65"><span>Unhurried</span><span>Brisk</span></div>
      <p className="mt-2 text-xs leading-5 text-white/60">Applies to the next spoken passage. Voice pitch stays natural.</p>
      {onVoiceMode && <div className="mt-3"><p className="text-xs font-bold text-white/75">Voice quality</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>onVoiceMode('max_hours')} aria-pressed={voiceMode==='max_hours'} className={`rounded-lg p-2 text-xs ${voiceMode==='max_hours'?'bg-amber-300 text-slate-950':'bg-white/10'}`}>Max Hours<br/><span className="font-normal">Aura 1</span></button><button type="button" onClick={()=>onVoiceMode('studio_clarity')} aria-pressed={voiceMode==='studio_clarity'} className={`rounded-lg p-2 text-xs ${voiceMode==='studio_clarity'?'bg-amber-300 text-slate-950':'bg-white/10'}`}>Studio<br/><span className="font-normal">Aura 2</span></button></div></div>}
      <button type="button" onClick={onSound} className="mt-3 w-full rounded-lg bg-white/10 p-2">{muted?'Unmute tutor':blocked?'Enable sound':'Mute tutor'}</button>
      <button type="button" onClick={onMode} aria-pressed={pressToTalk} className="mt-2 w-full rounded-lg bg-white/10 p-2">{pressToTalk?'Switch to open mic':'Switch to hold to ask'}</button>
    </div>
  </details>;
}
