'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LiveClassVisualStage from '@/components/LiveClassVisualStage';
import type { PhysiologyPreset } from '@/components/PhysiologySimulator';
import { LIVE_CLASS_MODEL_ASSETS, getLiveClassModelLabel, type VisualContext } from '@/lib/voice/live-class-visuals';

const MODEL_OPTIONS = [
  LIVE_CLASS_MODEL_ASSETS.coagulativeNecrosis,
  LIVE_CLASS_MODEL_ASSETS.gramCellEnvelope,
  LIVE_CLASS_MODEL_ASSETS.acuteInflammation,
  LIVE_CLASS_MODEL_ASSETS.antibodyAntigen,
  LIVE_CLASS_MODEL_ASSETS.receptorOccupancy,
  LIVE_CLASS_MODEL_ASSETS.glomerularInflammation,
  LIVE_CLASS_MODEL_ASSETS.invasiveCarcinoma,
  ...Object.values(LIVE_CLASS_MODEL_ASSETS).filter(url => url.includes('/hra-v25/')),
] as const;
const SIMULATIONS: Array<{preset:PhysiologyPreset;label:string}> = [
  { preset: 'acid_base_balance', label: 'Acid–base lab' },
  { preset: 'anion_gap', label: 'Anion gap lab' },
  { preset: 'drug_half_life', label: 'Drug elimination lab' },
  { preset: 'competitive_antagonism', label: 'Agonist vs antagonist lab' },
  { preset: 'oxygen_content', label: 'Oxygen content lab' },
  { preset: 'renal_clearance', label: 'Renal clearance lab' },
  { preset: 'cardiac_output', label: 'Cardiac output lab' },
];

export default function VisualLabPage() {
  const [choice, setChoice] = useState('model:'+MODEL_OPTIONS[0]);
  const [storedModels, setStoredModels] = useState<Array<{ url: string; title: string; category: string }>>([]);
  const [modelLibraryState, setModelLibraryState] = useState('Loading actual 3D medical models…');
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/voice/models', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Medical model catalogue is unavailable');
        const result = await response.json() as {
          count?: number; truncated?: boolean;
          models?: Array<{ url: string; title: string; category: string }>;
        };
        const models = (result.models || []).filter(item =>
          typeof item.url === 'string' && typeof item.title === 'string'
          && item.url.startsWith('https://hixvbcrrklyajhkyliay.supabase.co/storage/v1/object/public/medical-models/')
          && item.url.toLowerCase().endsWith('.glb'));
        setStoredModels(models);
        setModelLibraryState(models.length ? models.length + ' real Supabase 3D models discovered'
          + (result.truncated ? ' (catalogue limit reached)' : '')
          : 'No compatible stored 3D models found');
      })
      .catch(() => { if (!controller.signal.aborted) setModelLibraryState('Curated previews only; real bucket catalogue unavailable'); });
    return () => controller.abort();
  }, []);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [structure, setStructure] = useState('');
  const [experiment, setExperiment] = useState('');
  const [labState, setLabState] = useState('');
  const visualContext: VisualContext = choice.startsWith('simulation:')
    ? { type: 'simulation', preset: choice.slice('simulation:'.length) as PhysiologyPreset,
        title: SIMULATIONS.find(x => choice.endsWith(x.preset))?.label || 'Interactive laboratory' }
    : { type: 'model', modelUrl: choice.slice('model:'.length),
        title: storedModels.find(item => item.url === choice.slice('model:'.length))?.title,
        category: storedModels.find(item => item.url === choice.slice('model:'.length))?.category };

  const label = visualContext.type === 'model' ? getLiveClassModelLabel(visualContext.modelUrl) : visualContext.title;
  return (
    <main className="relative min-h-dvh bg-[#080d16] text-white">
      <div className="relative z-40 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0b1422] px-3 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#ffd080]">LenxiQ · Working visual laboratory</p>
          <h1 className="text-base font-bold sm:text-xl">Hands-on medical learning</h1>
        </div>
        <Link className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/10" href="/voice?mode=class">Open Live Class</Link>
      </div>
      <section className="relative z-30 flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#101827] px-3 py-3 sm:px-6" aria-label="Visual laboratory selector">
        <label htmlFor="lab-visual" className="text-xs font-semibold text-white/70">Select an experiment</label>
        <select id="lab-visual" aria-label="Medical model or clinical simulation"
          value={choice}
          onChange={e => { setChoice(e.target.value); setStructure(''); setExperiment(''); setLabState(''); }}
          className="min-w-[min(92vw,28rem)] max-w-full rounded-lg border border-white/20 bg-[#17273c] p-2.5 text-xs font-semibold text-white">
          <optgroup label="Manipulatable 3D medical models">
            {MODEL_OPTIONS.map(url => <option key={url} value={'model:'+url}>{getLiveClassModelLabel(url)}</option>)}
          </optgroup>
          {storedModels.length > 0 && <optgroup label={`From Supabase medical-models (${storedModels.length})`}>
              {storedModels.map(asset => <option key={asset.url} value={'model:'+asset.url}>{asset.title} · {asset.category}</option>)}
            </optgroup>}
            <optgroup label="Adjustable clinical and drug simulations">
            {SIMULATIONS.map(x => <option key={x.preset} value={'simulation:'+x.preset}>{x.label}</option>)}
          </optgroup>
        </select>
        <span className="text-xs text-white/50">{modelLibraryState} · rotate, tap, isolate, zoom</span>
      </section>
      <div className="relative h-[min(75dvh,800px)] min-h-[420px] w-full overflow-hidden" data-testid="visual-lab-stage" data-tutor-contract="v3" data-interactive={hydrated ? "true" : "false"}>
        <LiveClassVisualStage key={choice} visualContext={visualContext}
          selectedStructure={structure}
          onStructureSelect={name => setStructure(name)}
          onConceptSelect={text => setExperiment(text)}
          onSimulationState={snapshot => setLabState('Lab state: ' + JSON.stringify(snapshot))}
          onSimulationResult={snapshot => setExperiment('Ask tutor: ' + JSON.stringify(snapshot))} />
      </div>
      <div className="relative z-30 flex flex-wrap items-center gap-4 border-t border-white/10 bg-[#101827] px-4 py-3 text-xs sm:px-8">
        <p className="min-w-0"><span className="text-white/50">Active:</span> <span className="font-semibold">{label}</span></p>
        {visualContext.type === 'model' && <p data-testid="selected-structure"><span className="text-white/50">Selected structure:</span> <span className="font-semibold text-[#ffd080]">{structure || 'Tap a part of the 3D model'}</span></p>}
        {(experiment || labState) && <p data-testid="simulator-observation" className="max-w-full truncate text-[#ffd080]">{experiment || labState}</p>}
      </div>
      <p className="px-4 pb-5 pt-2 text-[11px] text-white/50 sm:px-8">
        Models and clinical calculations are for teaching. This visual preview uses the same rendering components as Live Class; voice tutor interaction is available inside a signed-in Live Class session.
      </p>
    </main>
  );
}
