'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GLViewer } from '3dmol';

type MoleculeViewerProps = {
  modelUrl: string;
  pdbId: string;
  ligand: string;
  ligandResidue: string;
};

export default function MoleculeViewer({ modelUrl, pdbId, ligand, ligandResidue }: MoleculeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<GLViewer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let viewer: GLViewer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const controller = new AbortController();

    const load = async () => {
      setStatus('loading');
      setError('');
      try {
        const [moleculeLibrary, response] = await Promise.all([
          import('3dmol'),
          fetch(modelUrl, { signal: controller.signal, cache: 'force-cache' }),
        ]);
        if (!response.ok) throw new Error(`PDB ${pdbId} could not be loaded (${response.status}).`);
        const pdbText = await response.text();
        if (!pdbText.includes('ATOM  ') && !pdbText.includes('HETATM')) throw new Error('The structure file contains no readable atom records.');
        if (cancelled || !containerRef.current) return;

        viewer = moleculeLibrary.createViewer(containerRef.current, {
          backgroundColor: '#080d16',
          antialias: true,
        });
        if (!viewer) throw new Error('This browser could not create a 3D molecule viewer.');
        viewerRef.current = viewer;
        viewer.addModel(pdbText, 'pdb');
        viewer.setStyle({ hetflag: false }, { cartoon: { colorscheme: 'spectrum', opacity: 0.92 } });
        viewer.setStyle({ resn: ligandResidue }, { stick: { colorscheme: 'Jmol', radius: 0.22 } });
        viewer.zoomTo();
        viewer.render();
        resizeObserver = new ResizeObserver(() => viewer?.resize());
        resizeObserver.observe(containerRef.current);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled || controller.signal.aborted) return;
        viewer?.clear();
        viewer = null;
        viewerRef.current = null;
        setError(loadError instanceof Error ? loadError.message : 'The molecular structure could not be displayed.');
        setStatus('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      resizeObserver?.disconnect();
      viewer?.clear();
      viewerRef.current = null;
      container.replaceChildren();
    };
  }, [ligandResidue, modelUrl, pdbId]);

  const resetView = useCallback(() => {
    viewerRef.current?.zoomTo();
    viewerRef.current?.render();
  }, []);

  return (
    <div className="absolute inset-0" aria-label={`${pdbId} interactive pharmacology structure`}>
      <div ref={containerRef} className="absolute inset-0 touch-none" />
      {status !== 'ready' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-5">
          <div className="max-w-sm rounded-2xl border border-white/10 bg-[#101827]/90 px-5 py-4 text-center shadow-xl backdrop-blur-xl">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#ffd68d]">{status === 'loading' ? 'Preparing molecular structure' : 'Structure unavailable'}</p>
            <p className="mt-2 text-sm leading-6 text-white/75">{status === 'loading' ? `Loading PDB ${pdbId} and highlighting ${ligand}…` : error}</p>
          </div>
        </div>
      )}
      {status === 'ready' && (
        <button
          type="button"
          onClick={resetView}
          className="absolute bottom-24 right-4 rounded-xl border border-white/15 bg-[#101827]/75 px-3 py-2 text-[10px] font-bold text-white/75 shadow-lg backdrop-blur-xl transition hover:bg-white/10 sm:bottom-8 sm:right-8"
          aria-label="Reset molecule view"
        >
          Reset view
        </button>
      )}
    </div>
  );
}
