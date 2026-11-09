'use client';
/* Tutor-provided medical media URLs are dynamic and intentionally bypass Next's static image loader. */
/* eslint-disable @next/next/no-img-element */

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import Whiteboard from '@/components/Whiteboard';
import PhysiologySimulator, { type SimulationSnapshot } from '@/components/PhysiologySimulator';
import type { VisualContext } from '@/lib/voice/live-class-visuals';
import { getLiveClassModelLabel } from '@/lib/voice/live-class-visuals';
import { getLiveClassModelCatalogEntry, getLiveClassMoleculeCatalogEntry } from '@/lib/voice/live-class-model-catalog';

const AnatomyViewer = dynamic(() => import('@/components/AnatomyViewer'), { ssr: false });
const MoleculeViewer = dynamic(() => import('@/components/MoleculeViewer'), { ssr: false });

type LiveClassVisualStageProps = {
  visualContext: VisualContext;
  selectedStructure?: string;
  onStructureSelect?: (structureId: string) => void;
  onConceptSelect?: (concept: string, index: number) => void;
  onSimulationState?: (snapshot: SimulationSnapshot) => void;
  onSimulationResult?: (snapshot: SimulationSnapshot) => void;
  onMediaSelect?: (point:{mediaUrl:string;caption:string;x:number;y:number}) => void;
};

function InspectableImage({ src, alt, onSelect }: { src: string; alt: string; onSelect?:LiveClassVisualStageProps['onMediaSelect'] }) {
  const imageRef=useRef<HTMLImageElement>(null);
  const [point,setPoint]=useState<{x:number;y:number}|null>(null);
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const pinch=useRef<{distance:number;zoom:number}|null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointerStart = useRef<{ id: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const clampZoom = (value: number) => Math.min(4, Math.max(0.75, Number(value.toFixed(2))));

  return (
    <div className="relative max-h-[78dvh] max-w-6xl overflow-hidden rounded-[2rem] border border-white/15 bg-black/30 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
      <div
        className="flex max-h-[78dvh] min-h-[16rem] min-w-[min(84vw,40rem)] cursor-grab items-center justify-center overflow-hidden touch-none active:cursor-grabbing"
        onWheel={(event) => { event.preventDefault(); setZoom((value) => clampZoom(value * (event.deltaY < 0 ? 1.12 : 0.89))); }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
          if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom};pointerStart.current=null;return;}
          pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
        }}
        onPointerMove={(event) => {
          if(pointers.current.has(event.pointerId))pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
          if(pinch.current&&pointers.current.size===2){const [a,b]=[...pointers.current.values()];setZoom(clampZoom(pinch.current.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.current.distance)));return;}
          const start = pointerStart.current;
          if (!start || start.id !== event.pointerId) return;
          setOffset({ x: start.offsetX + event.clientX - start.x, y: start.offsetY + event.clientY - start.y });
        }}
        onPointerUp={(event) => {
          const start=pointerStart.current;const bounds=imageRef.current?.getBoundingClientRect();
          if(start?.id===event.pointerId&&bounds&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<7){const x=(event.clientX-bounds.left)/bounds.width,y=(event.clientY-bounds.top)/bounds.height;if(x>=0&&x<=1&&y>=0&&y<=1){setPoint({x,y});onSelect?.({mediaUrl:src,caption:alt,x,y});}}
          pointers.current.delete(event.pointerId);pinch.current=null;pointerStart.current=null;
        }}
        onPointerCancel={() => { pointerStart.current=null;pointers.current.clear();pinch.current=null; }}
      >
        <div className="relative transition-transform duration-150" style={{transform:`translate(${offset.x}px, ${offset.y}px) scale(${zoom})`}}>
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[78dvh] max-w-full select-none object-contain transition-transform duration-150"
        />
        {point&&<span aria-hidden="true" className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 bg-amber-300/20 shadow-[0_0_0_5px_#e8a23d30]" style={{left:`${point.x*100}%`,top:`${point.y*100}%`}}/>}
        </div>
      </div>
      {point&&<span role="status" className="pointer-events-none absolute right-3 top-3 rounded-full border border-amber-300/50 bg-slate-950/90 px-3 py-2 text-xs font-bold text-amber-100">Ask your question, then point to a part</span>}
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-white/10 bg-[#101827]/80 p-1.5 backdrop-blur-xl" aria-label="Image zoom controls">
        <button type="button" onClick={() => setZoom((value) => clampZoom(value - 0.2))} className="h-8 w-8 rounded-lg text-lg font-bold text-white/80 hover:bg-white/10" aria-label="Zoom out">−</button>
        <span className="min-w-11 text-center text-[10px] font-black tabular-nums text-white/60">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => clampZoom(value + 0.2))} className="h-8 w-8 rounded-lg text-lg font-bold text-white/80 hover:bg-white/10" aria-label="Zoom in">+</button>
        <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="rounded-lg px-2 py-1 text-[9px] font-bold text-white/65 hover:bg-white/10" aria-label="Reset image view">Reset</button>
      </div>
    </div>
  );
}

export default function LiveClassVisualStage({ visualContext, selectedStructure, onStructureSelect, onConceptSelect, onSimulationState, onSimulationResult, onMediaSelect }: LiveClassVisualStageProps) {
  const [modelViewMode, setModelViewMode] = useState<'normal' | 'xray' | 'isolate'>('normal');
  if (visualContext.type === 'simulation') {
    return (
      <section className="flex h-full min-h-0 w-full items-start justify-center overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_50%_25%,rgba(35,57,85,.7),#070b13_68%)] px-4 pb-8 pt-6 sm:items-center sm:px-8 sm:py-20" aria-label="Interactive physiology simulation">
        <PhysiologySimulator preset={visualContext.preset} title={visualContext.title} onConceptSelect={onConceptSelect} onSimulationState={onSimulationState} onSimulationResult={onSimulationResult} />
      </section>
    );
  }

  if (visualContext.type === 'model') {
    const catalogEntry = getLiveClassModelCatalogEntry(visualContext.modelUrl);
    const modelName = visualContext.title || getLiveClassModelLabel(visualContext.modelUrl);
    const modelCategory = visualContext.category || catalogEntry?.category || 'medical 3D';
    const sourceUrl = catalogEntry && 'sourceUrl' in catalogEntry ? catalogEntry.sourceUrl : undefined;
    const sourceLabel = catalogEntry && 'sourceLabel' in catalogEntry ? catalogEntry.sourceLabel : undefined;
    const licenseLabel = catalogEntry && 'licenseLabel' in catalogEntry ? catalogEntry.licenseLabel : undefined;
    const recordUrl = catalogEntry && 'recordUrl' in catalogEntry ? catalogEntry.recordUrl : undefined;
    const licenseUrl = catalogEntry && 'licenseUrl' in catalogEntry ? catalogEntry.licenseUrl : undefined;
    const sourceLinkUrl = recordUrl ?? sourceUrl;
    const focusedStructure = selectedStructure || visualContext.structureId;
    return (
      <section className="relative h-full w-full overflow-hidden" aria-label={`Interactive 3D ${modelCategory} model: ${modelName}`}>
        <AnatomyViewer
          modelUrl={visualContext.modelUrl}
          highlightStructure={focusedStructure}
          highlightColor={visualContext.highlightColor}
          viewMode={modelViewMode}
          onStructureSelect={onStructureSelect}
        />
        <div className="absolute left-4 right-4 top-[5.2rem] z-10 sm:left-8 sm:right-8 sm:top-24">
          <h2 className="pointer-events-none max-w-3xl text-2xl font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_#000] sm:text-4xl">{modelName}</h2>
          {focusedStructure&&<p className="pointer-events-none mt-2 inline-block rounded-full border border-[#e8a23d]/40 bg-[#0b1422]/85 px-3 py-1.5 text-sm font-bold text-[#ffd080]">{focusedStructure}</p>}
          {(sourceLinkUrl||licenseLabel)&&<details className="mt-2 w-fit rounded-lg bg-[#0b1422]/65 px-2 py-1 text-[10px] text-white/60"><summary className="cursor-pointer">Source</summary><div className="mt-2 flex max-w-xs flex-wrap gap-2">{sourceLinkUrl&&<a href={sourceLinkUrl} target="_blank" rel="noreferrer" className="underline">{sourceLabel||'Source record'}</a>}{licenseLabel&&(licenseUrl?<a href={licenseUrl} target="_blank" rel="noreferrer" className="underline">{licenseLabel}</a>:<span>{licenseLabel}</span>)}</div></details>}
        </div>
        <div className="pointer-events-auto absolute bottom-[8.5rem] right-3 z-20 flex flex-wrap items-center gap-1 rounded-xl border border-white/15 bg-[#101827]/85 p-1.5 shadow-lg backdrop-blur-xl sm:bottom-8 sm:right-8" aria-label="3D model inspection controls">
          <button type="button" onClick={() => setModelViewMode('normal')} aria-pressed={modelViewMode === 'normal'} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${modelViewMode === 'normal' ? 'bg-[#e8a23d] text-[#101827]' : 'text-white/80 hover:bg-white/10'}`}>3D</button>
          <button type="button" onClick={() => setModelViewMode('xray')} aria-pressed={modelViewMode === 'xray'} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${modelViewMode === 'xray' ? 'bg-[#e8a23d] text-[#101827]' : 'text-white/80 hover:bg-white/10'}`}>X-ray</button>
          <button type="button" disabled={!focusedStructure} onClick={() => setModelViewMode('isolate')} aria-pressed={modelViewMode === 'isolate'} title={focusedStructure ? 'Hide other parts and focus on the selected structure' : 'Select a structure first'} className={`rounded-lg px-3 py-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${modelViewMode === 'isolate' ? 'bg-[#e8a23d] text-[#101827]' : 'text-white/80 hover:bg-white/10'}`}>Isolate</button>
        </div>
      </section>
    );
  }

  if (visualContext.type === 'molecule') {
    const catalogEntry = getLiveClassMoleculeCatalogEntry(visualContext.modelUrl);
    return (
      <section className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_38%,rgba(35,57,85,.45),#070b13_70%)]" aria-label={`Interactive pharmacology model: ${visualContext.title}`}>
        <MoleculeViewer
          modelUrl={visualContext.modelUrl}
          pdbId={visualContext.pdbId}
          ligand={visualContext.ligand}
          ligandResidue={catalogEntry?.ligandResidue ?? 'CAU'}
        />
        <div className="absolute left-4 right-4 top-[5.2rem] z-10 sm:left-8 sm:top-24">
          <h2 className="pointer-events-none max-w-3xl text-2xl font-black leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_#000] sm:text-4xl">{visualContext.title}</h2>
          <p className="pointer-events-none mt-2 text-sm font-bold text-[#ffd080]">{visualContext.ligand}</p>
          {catalogEntry?.sourceUrl&&<details className="mt-2 w-fit rounded-lg bg-[#0b1422]/65 px-2 py-1 text-[10px] text-white/60"><summary className="cursor-pointer">Source</summary><a href={catalogEntry.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">RCSB PDB · {visualContext.pdbId} · CC0</a></details>}
        </div>
      </section>
    );
  }

  if (visualContext.type === 'media') {
    const isVideo = /\.(mp4|webm|mov)(?:\?|$)/i.test(visualContext.mediaUrl);
    return (
      <section className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#070b13] p-5 sm:p-10" aria-label="Medical concept media">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(232,162,61,0.18),transparent_34%),linear-gradient(135deg,#101827,#070b13)]" />
        <div className="relative flex max-h-[82dvh] max-w-6xl flex-col items-center">
          {isVideo
            ? <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-black/30 shadow-[0_30px_120px_rgba(0,0,0,0.45)]"><video src={visualContext.mediaUrl} controls playsInline className="max-h-[78dvh] max-w-full object-contain" /></div>
            : <InspectableImage src={visualContext.mediaUrl} alt={visualContext.caption || 'Medical concept visual'} onSelect={onMediaSelect} />}
          {visualContext.caption && <p className="mt-3 max-w-4xl text-center text-xs font-bold text-white/70">{visualContext.caption}</p>}
        </div>
      </section>
    );
  }

  return <Whiteboard topic={visualContext.topic} markdown={visualContext.markdown} onConceptSelect={onConceptSelect} />;
}
