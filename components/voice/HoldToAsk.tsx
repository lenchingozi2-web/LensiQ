'use client';
import { useRef } from 'react';
export type AskPhase='idle'|'holding'|'listening'|'processing'|'empty';
export default function HoldToAsk({phase,onHold}:{phase:AskPhase;onHold:(held:boolean,cancel?:boolean)=>void}){
  const held=useRef(false);
  const release=(cancel=false)=>{if(held.current){held.current=false;onHold(false,cancel);}};
  const listening=phase==='holding'||phase==='listening';
  return <button type="button" data-testid="hold-to-ask" aria-label={listening?'Listening. Release to send your question':'Hold to ask a question'} aria-pressed={listening} disabled={phase==='processing'}
    style={{WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none',touchAction:'none'}}
    className={`min-h-12 flex-1 basis-full select-none rounded-xl border-2 px-4 text-xs font-black transition sm:basis-auto ${listening?'border-emerald-100 bg-emerald-400 text-[#082218] ring-4 ring-emerald-300/40':phase==='processing'?'border-amber-200/50 bg-amber-100/20 text-amber-100':'border-[#ffe4a4] bg-[#e8a23d] text-[#0b1422]'}`}
    onContextMenu={event=>event.preventDefault()} onDragStart={event=>event.preventDefault()}
    onPointerDown={event=>{if(!event.isPrimary||event.button!==0||held.current)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);held.current=true;onHold(true);}}
    onPointerUp={event=>{event.preventDefault();release();}}
    onPointerCancel={()=>release(true)} onLostPointerCapture={()=>release(true)}
    onKeyDown={event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();if(!held.current){held.current=true;onHold(true);}}}}
    onKeyUp={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();release();}}}
    onBlur={()=>release(true)}>
    {listening?'● Listening · release to send':phase==='processing'?'Sending your question…':'Hold to ask'}
  </button>;
}
