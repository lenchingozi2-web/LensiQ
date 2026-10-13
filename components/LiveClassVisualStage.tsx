'use client';
/* Tutor-provided medical media URLs are dynamic and intentionally bypass Next's static image loader. */
/* eslint-disable @next/next/no-img-element */

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import Whiteboard from '@/components/Whiteboard';
import PhysiologySimulator from '@/components/PhysiologySimulator';
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
};

function InspectableImage({ src, alt }: { src: string; alt: string }) {
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
          pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
        }}
        onPointerMove={(event) => {
          const start = pointerStart.current;
          if (!start || start.id !== event.pointerId) return;
          setOffset({ x: start.offsetX + event.clientX - start.x, y: start.offsetY + event.clientY - start.y });
        }}
        onPointerUp={(event) => { if (pointerStart.current?.id === event.pointerId) pointerStart.current = null; }}
        onPointerCancel={() => { pointerStart.current = null; }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[78dvh] max-w-full select-none object-contain transition-transform duration-150"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        />
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-white/10 bg-[#101827]/80 p-1.5 backdrop-blur-xl" aria-label="Image zoom controls">
        <button type="button" onClick={() => setZoom((value) => clampZoom(value - 0.2))} className="h-8 w-8 rounded-lg text-lg font-bold text-white/80 hover:bg-white/10" aria-label="Zoom out">−</button>
        <span className="min-w-11 text-center text-[10px] font-black tabular-nums text-white/60">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => clampZoom(value + 0.2))} className="h-8 w-8 rounded-lg text-lg font-bold text-white/80 hover:bg-white/10" aria-label="Zoom in">+</button>
        <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="rounded-lg px-2 py-1 text-[9px] font-bold text-white/65 hover:bg-white/10" aria-label="Reset image view">Reset</button>
      </div>
    </div>
  );
}

export default function LiveClassVisualStage({ visualContext, selectedStructure, onStructureSelect, onConceptSelect }: LiveClassVisualStageProps) {
  if (visualContext.type === 'simulation') {
    return (
      <section className="flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(circle_at_50%_25%,rgba(35,57,85,.7),#070b13_68%)] px-4 py-20 sm:px-8" aria-label="Interactive physiology simulation">
        <PhysiologySimulator preset={visualContext.preset} title={visualContext.title} />
      </section>
    );
  }

  if (visualContext.type === 'model') {
    const catalogEntry = getLiveClassModelCatalogEntry(visualContext.modelUrl);
    const modelName = getLiveClassModelLabel(visualContext.modelUrl);
    const modelCategory = catalogEntry?.category ?? 'anatomy';
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
          onStructureSelect={onStructureSelect}
        />
        <div className="pointer-events-none absolute left-4 top-[6.25rem] max-w-[min(78vw,24rem)] rounded-2xl border border-white/10 bg-[#101827]/65 px-4 py-3 shadow-xl backdrop-blur-xl sm:left-8 sm:top-28 sm:px-5">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ffd68d]">Interactive 3D {modelCategory}</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-2xl">{modelName}{focusedStructure && <span className="text-white/60"> · {focusedStructure}</span>}</h2>
          <p className="mt-1 text-[10px] font-semibold text-white/55 sm:text-xs">Drag to rotate · pinch or scroll to zoom · tap a structure to focus</p>
          {catalogEntry?.source && <p className="mt-1 text-[9px] font-medium leading-4 text-white/45">{catalogEntry.source}</p>}
          {(sourceLinkUrl || licenseLabel) && (
            <div className="pointer-events-auto mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold uppercase tracking-[0.12em]">
              {sourceLinkUrl && <a className="text-[#ffd68d] underline decoration-white/20 underline-offset-4 hover:text-white" href={sourceLinkUrl} target="_blank" rel="noreferrer">{recordUrl ? 'Source record' : sourceLabel ?? 'Source'}</a>}
              {licenseLabel && (licenseUrl
                ? <a className="text-white/55 underline decoration-white/20 underline-offset-4 hover:text-white" href={licenseUrl} target="_blank" rel="noreferrer">License · {licenseLabel}</a>
                : <span className="text-white/45">{sourceLabel ? `${sourceLabel} · ` : ''}{licenseLabel}</span>)}
            </div>
          )}
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
        <div className="pointer-events-none absolute left-4 top-[6.25rem] max-w-[min(78vw,25rem)] rounded-2xl border border-white/10 bg-[#101827]/70 px-4 py-3 shadow-xl backdrop-blur-xl sm:left-8 sm:top-28 sm:px-5">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ffd68d]">Interactive drug–target structure</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-white sm:text-2xl">{visualContext.title}</h2>
          <p className="mt-1 text-xs font-semibold text-white/65">Bound ligand · {visualContext.ligand} <span className="text-white/35">· PDB {visualContext.pdbId}</span></p>
          <p className="mt-1 text-[10px] font-medium text-white/45">Drag to rotate · pinch or scroll to zoom · the ligand is highlighted</p>
          {visualContext.note && <p className="mt-1 text-[9px] leading-4 text-white/40">{visualContext.note}</p>}
          {catalogEntry?.sourceUrl && (
            <a className="pointer-events-auto mt-2 inline-flex text-[9px] font-bold uppercase tracking-[0.14em] text-[#ffd68d] underline decoration-white/20 underline-offset-4 hover:text-white" href={catalogEntry.sourceUrl} target="_blank" rel="noreferrer">
              Source · RCSB PDB · CC0
            </a>
          )}
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
            : <InspectableImage src={visualContext.mediaUrl} alt={visualContext.caption || 'Medical concept visual'} />}
          {visualContext.caption && <p className="mt-3 max-w-4xl text-center text-xs font-bold text-white/70">{visualContext.caption}</p>}
        </div>
      </section>
    );
  }

  return <Whiteboard topic={visualContext.topic} markdown={visualContext.markdown} onConceptSelect={onConceptSelect} />;
}
