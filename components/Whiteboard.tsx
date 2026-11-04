'use client';
import {useMemo,useState} from 'react';
import {lessonPoints,visibleFlowIndexes} from '@/lib/voice/lesson-presentation';
type WhiteboardProps={topic:string;markdown?:string;onConceptSelect?:(concept:string,index:number)=>void};
export default function Whiteboard({topic,markdown,onConceptSelect}:WhiteboardProps){
 const steps=useMemo(()=>lessonPoints(markdown??''),[markdown]);
 const [selected,setSelected]=useState(0);const [following,setFollowing]=useState(true);const [flow,setFlow]=useState(false);const [zoom,setZoom]=useState(1);
 const active=Math.max(0,Math.min(following?steps.length-1:selected,steps.length-1));
 const indexes=visibleFlowIndexes(active);
 function browse(index:number){setFollowing(false);setSelected(Math.max(0,Math.min(index,steps.length-1)));}
 return <section className="relative h-full w-full overflow-hidden bg-[#070e18] text-white" aria-label="Interactive medical teaching board">
  <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(#ffffff0b_1px,transparent_1px),linear-gradient(90deg,#ffffff0b_1px,transparent_1px)] [background-size:42px_42px]"/>
  <header className="absolute inset-x-0 top-[4.8rem] z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1422]/90 px-4 py-3 backdrop-blur-lg sm:top-24 sm:px-8">
   <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#ffd080]">Live concept board</p><h1 className="mt-1 truncate text-base font-bold sm:text-xl">{topic||'Medical lesson'}</h1></div>
   <div className="flex shrink-0 gap-1"><button onClick={()=>setFlow(!flow)} aria-pressed={flow} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold">{flow?'Focus':'Flow'}</button><button onClick={()=>setZoom(z=>Math.max(.8,z-.1))} aria-label="Zoom out" className="rounded-lg border border-white/15 px-3 py-2">−</button><button onClick={()=>setZoom(z=>Math.min(1.4,z+.1))} aria-label="Zoom in" className="rounded-lg border border-white/15 px-3 py-2">+</button></div>
  </header>
  <div className="absolute inset-x-0 bottom-[9.8rem] top-[9.4rem] flex items-center justify-center overflow-y-auto px-5 py-5 sm:top-44 sm:px-12" style={{touchAction:'pan-y'}}>
   {steps.length===0?<h2 className="text-center text-2xl font-bold text-white/75 sm:text-4xl">{topic||'Live Class'}</h2>:<div className="my-auto w-full max-w-3xl space-y-3" style={{zoom}}>
    {indexes.map((index,position)=><div key={index+'-'+steps[index]} className="animate-[lab-reveal_300ms_ease-out_both]">
     {flow&&position>0&&<p aria-hidden="true" className="py-2 text-center text-xl text-[#e8a23d]/70">↓</p>}
     <button type="button" onClick={()=>onConceptSelect?.(steps[index],index)} aria-current={index===active?'step':undefined} aria-label={`Ask about: ${steps[index]}`} className={`w-full rounded-2xl border px-5 py-4 text-left transition sm:px-7 sm:py-5 ${index===active?'border-[#e8a23d]/60 bg-[#e8a23d]/[.10]':'border-white/10 bg-[#142235]/60'}`}>
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-[.18em] text-[#ffd080]">{index===active&&following?'Current key point':'Key point'}</span>
      <span className={`block font-semibold leading-snug tracking-tight ${index===active?'text-xl sm:text-2xl':'text-lg sm:text-xl'} ${index===active?'text-white':'text-white/55'}`}>{steps[index]}</span>
     </button>
    </div>)}
   </div>}
  </div>
  {steps.length>0&&<nav aria-label="Concept navigation" className="absolute bottom-[5.4rem] left-4 right-4 z-10 mx-auto flex max-w-3xl items-center justify-between rounded-xl border border-white/10 bg-[#0b1422]/90 p-2 text-xs font-bold backdrop-blur-xl sm:bottom-24"><button onClick={()=>browse(active-1)} disabled={active===0} className="rounded-lg px-3 py-2 disabled:opacity-30">← Back</button>{following?<span className="text-white/55">Follow tutor · {active+1}</span>:<button onClick={()=>setFollowing(true)} className="rounded-lg bg-[#e8a23d]/15 px-3 py-2 text-[#ffd080]">Follow tutor ↗</button>}<button onClick={()=>browse(active+1)} disabled={active===steps.length-1} className="rounded-lg px-3 py-2 disabled:opacity-30">Next →</button></nav>}
 </section>;
}
