'use client';

import type { ComponentProps, ReactNode } from 'react';
import LiveClassVisualStage from '@/components/LiveClassVisualStage';
import { getLiveClassModelCatalogEntry, getLiveClassMoleculeCatalogEntry } from '@/lib/voice/live-class-model-catalog';
import type { PhysiologyPreset } from '@/components/PhysiologySimulator';
import type { VisualCue, Citation } from '@/lib/live-class/visual-protocol';
import type { VisualContext } from '@/lib/voice/live-class-visuals';

type Existing=ComponentProps<typeof LiveClassVisualStage>;
type Props=Existing&{cue:VisualCue|null;steps:string[];citations:Citation[];cueIndex?:number;cueCount?:number};
export default function DynamicWhiteboardStage({cue,steps,citations,cueIndex=0,cueCount=0,...original}:Props){
  if(!cue)return <LiveClassVisualStage {...original}/>;
  const visualWithNotes=(stage:ReactNode)=><div className="relative h-full w-full">{stage}<aside className="pointer-events-none absolute left-3 right-3 z-10 mx-auto max-w-xl rounded-xl border border-white/15 bg-[#0d1827]/90 p-3 text-white" style={{bottom:'calc(var(--class-dock-height, 160px) + 8px)'}} aria-label="Current teaching anchors"><p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">{cue.title}</p>{cue.steps.slice(-2).map((note,i)=><p key={i} className="mt-1 text-sm">{note}</p>)}</aside></div>;
  if(cue.mode==='anatomy_3d'&&cue.asset_url&&getLiveClassModelCatalogEntry(cue.asset_url)){
    const context:VisualContext={type:'model',modelUrl:cue.asset_url,title:cue.title,structureId:original.selectedStructure||cue.structure_id};
    return visualWithNotes(<LiveClassVisualStage {...original} visualContext={context}/>);
  }
  if(cue.mode==='molecule_3d'&&cue.asset_url){
    const asset=getLiveClassMoleculeCatalogEntry(cue.asset_url);
    if(asset){
      const context:VisualContext={
        type:'molecule',modelUrl:asset.modelUrl,pdbId:asset.pdbId,ligand:asset.ligand,
        note:asset.note,title:cue.title,
      };
      return visualWithNotes(<LiveClassVisualStage {...original} visualContext={context}/>);
    }
  }
  const allowedPresets:PhysiologyPreset[]=['cardiac_output','mean_arterial_pressure','alveolar_ventilation',
    'acid_base_balance','anion_gap','drug_half_life','competitive_antagonism','oxygen_content','renal_clearance'];
  if(cue.mode==='physiology_sim'&&cue.structure_id&&allowedPresets.includes(cue.structure_id as PhysiologyPreset)){
    const context:VisualContext={type:'simulation',preset:cue.structure_id as PhysiologyPreset,title:cue.title};
    return visualWithNotes(<LiveClassVisualStage {...original} visualContext={context}/>);
  }
  if(cue.mode==='source_diagram'&&cue.asset_url&&/^https:\/\//i.test(cue.asset_url)){
    return <div className="flex h-full w-full flex-col items-center justify-center gap-3 overflow-auto bg-[#070b13] p-8" aria-label={cue.title}>
      {/* Signed, user-owned study diagrams are displayed only after validated server-side cue selection. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cue.asset_url} alt={cue.title} className="max-h-[75dvh] max-w-full rounded-xl object-contain" />
      <p className="text-sm font-bold text-white/75">{cue.title}</p>
    </div>;
  }
  return <section className="flex h-full w-full flex-col items-center justify-start overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_50%_20%,rgba(25,55,77,.6),#070b13_75%)] px-5 pt-28 text-white sm:px-12"
    style={{paddingBottom:'calc(var(--class-dock-height, 160px) + 24px)'}} aria-label={cue.mode==='whiteboard_scratchpad'?'Student question whiteboard':'Live progressive medical whiteboard'}>
    <div className="my-auto w-full max-w-5xl shrink-0 rounded-[1.8rem] border border-white/15 bg-[#0d1827]/85 p-5 shadow-2xl sm:p-10">
      <p className="text-xs font-black uppercase tracking-[.18em] text-[#ffd080]">
        {cue.mode==='whiteboard_scratchpad'?'Your question · tutor scratchpad':'Live whiteboard'}
      </p>
      {cueCount>1&&cue.mode!=='whiteboard_scratchpad'&&<p className="mt-2 text-xs tabular-nums text-white/50" aria-label="Teaching progression">Teaching point {cueIndex+1} of {cueCount}</p>}
      <h2 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">{cue.title}</h2>
      <div className="mt-7 space-y-3" aria-live="polite">
        {cue.comparison_table&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{cue.comparison_table.columns.map((c,i)=><th key={i} className="p-2 text-amber-200">{c}</th>)}</tr></thead><tbody>{cue.comparison_table.rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j} className="border-t border-white/10 p-2">{v}</td>)}</tr>)}</tbody></table></div>}
        {Boolean(cue.mechanism_flow_arrows?.length)&&<p className="rounded-xl bg-sky-400/10 p-3 text-sky-100">{cue.mechanism_flow_arrows?.join(' → ')}</p>}
        {!(cue.comparison_table||cue.mechanism_flow_arrows?.length)&&(cue.mode==='whiteboard_scratchpad'?cue.steps:steps).slice(-5).map((step,index)=>
          <button type="button" key={index+'-'+step.slice(0,30)} onClick={()=>original.onConceptSelect?.(step,index)} className={'board-anchor block w-full rounded-r-xl border-l-2 px-4 py-3 text-left text-base leading-7 transition hover:bg-white/10 sm:text-xl '+(cue.steps.includes(step)?'border-amber-300 bg-amber-300/[.07] text-white':'border-white/15 bg-white/[.02] text-white/55')} aria-current={cue.steps.includes(step)?'step':undefined} aria-label={'Ask about '+step}>
            {step}
          </button>)}
        {(cue.mode==='whiteboard_scratchpad'?cue.steps:steps).length===0&&<p className="text-sm text-white/60">{cue.mode==='whiteboard_scratchpad'?'Listening to your question…':'The tutor is preparing this visual checkpoint.'}</p>}
      </div>
      {cue.high_yield_pearl&&<p className="mt-6 rounded-xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm font-bold text-[#ffe1a0]">
        High-yield pearl · {cue.high_yield_pearl}
      </p>}
      {citations.length>0&&<details className="mt-7 border-t border-white/10 pt-4">
        <summary className="cursor-pointer text-xs font-bold text-white/50">Source references</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          {citations.slice(0,6).map((ref,index)=><span key={ref.file_name+ref.page_number+index}
            className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/70">
            {ref.file_name}{ref.page_number?' · p./slide '+ref.page_number:''}
          </span>)}
        </div>
      </details>}
    </div>
  </section>;
}
