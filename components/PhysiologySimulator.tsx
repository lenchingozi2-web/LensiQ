'use client';

import { useMemo, useState } from 'react';

export type PhysiologyPreset = 'cardiac_output' | 'mean_arterial_pressure' | 'alveolar_ventilation';

const PRESETS = {
  cardiac_output: {
    label: 'Cardiac output',
    output: 'Cardiac output',
    unit: 'L/min',
    initial: { heartRate: 72, strokeVolume: 70 },
    variables: [
      { key: 'heartRate', label: 'Heart rate', min: 40, max: 180, step: 1, unit: 'bpm' },
      { key: 'strokeVolume', label: 'Stroke volume', min: 30, max: 160, step: 1, unit: 'mL' },
    ],
    calculate: (v: Record<string, number>) => v.heartRate * v.strokeVolume / 1000,
    equation: 'CO = heart rate × stroke volume',
  },
  mean_arterial_pressure: {
    label: 'Arterial pressure',
    output: 'Mean arterial pressure',
    unit: 'mmHg',
    initial: { systolic: 120, diastolic: 80 },
    variables: [
      { key: 'systolic', label: 'Systolic pressure', min: 70, max: 220, step: 1, unit: 'mmHg' },
      { key: 'diastolic', label: 'Diastolic pressure', min: 30, max: 140, step: 1, unit: 'mmHg' },
    ],
    calculate: (v: Record<string, number>) => (v.systolic + 2 * v.diastolic) / 3,
    equation: 'MAP ≈ (systolic + 2 × diastolic) ÷ 3',
  },
  alveolar_ventilation: {
    label: 'Alveolar ventilation',
    output: 'Alveolar ventilation',
    unit: 'L/min',
    initial: { tidalVolume: 0.5, deadSpace: 0.15, respiratoryRate: 12 },
    variables: [
      { key: 'tidalVolume', label: 'Tidal volume', min: 0.15, max: 1.2, step: 0.01, unit: 'L' },
      { key: 'deadSpace', label: 'Dead-space volume', min: 0.05, max: 0.5, step: 0.01, unit: 'L' },
      { key: 'respiratoryRate', label: 'Respiratory rate', min: 4, max: 40, step: 1, unit: '/min' },
    ],
    calculate: (v: Record<string, number>) => Math.max(0, (v.tidalVolume - v.deadSpace) * v.respiratoryRate),
    equation: 'V̇A = (tidal volume − dead space) × respiratory rate',
  },
} satisfies Record<PhysiologyPreset, {
  label: string;
  output: string;
  unit: string;
  initial: Record<string, number>;
  variables: Array<{ key: string; label: string; min: number; max: number; step: number; unit: string }>;
  calculate: (values: Record<string, number>) => number;
  equation: string;
}>;

export default function PhysiologySimulator({ preset, title }: { preset: PhysiologyPreset; title: string }) {
  const model = PRESETS[preset];
  const [values, setValues] = useState<Record<string, number>>({ ...model.initial });
  const result = useMemo(() => model.calculate(values), [model, values]);
  const baseline = model.calculate(model.initial);
  const relative = baseline > 0 ? Math.max(0, Math.min(1, result / (baseline * 1.8))) : 0;

  return (
    <section className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#101827]/90 text-white shadow-[0_30px_120px_rgba(0,0,0,.45)] backdrop-blur-xl" aria-label={`${model.label} interactive physiology simulation`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-8">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#e8a23d]">Interactive physiology lab</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{title || model.label}</h2>
          <p className="mt-2 text-sm text-slate-400">Adjust a variable to see how the system responds.</p>
        </div>
        <div className="rounded-2xl border border-[#e8a23d]/25 bg-[#e8a23d]/10 px-4 py-3 text-right">
          <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#ffd68d]">{model.output}</p>
          <p className="mt-1 text-3xl font-black tabular-nums text-white">{result.toFixed(1)} <span className="text-sm font-bold text-[#ffd68d]">{model.unit}</span></p>
        </div>
      </div>
      <div className="grid gap-6 p-5 sm:grid-cols-[1fr_.8fr] sm:p-8">
        <div className="space-y-5">
          {model.variables.map((variable) => <label key={variable.key} className="block">
            <span className="flex items-center justify-between gap-3 text-sm font-bold text-slate-200"><span>{variable.label}</span><span className="rounded-lg bg-white/[.07] px-2.5 py-1 font-mono text-xs text-[#ffd68d]">{values[variable.key]} {variable.unit}</span></span>
            <input type="range" min={variable.min} max={variable.max} step={variable.step} value={values[variable.key]} onChange={(event) => setValues((previous) => ({ ...previous, [variable.key]: Number(event.target.value) }))} className="mt-3 w-full accent-[#e8a23d]" aria-label={variable.label} />
            <span className="mt-1 flex justify-between text-[10px] font-semibold text-slate-500"><span>{variable.min}</span><span>{variable.max} {variable.unit}</span></span>
          </label>)}
        </div>
        <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-[#070b13]/60 p-5">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-400">Model response</p>
          <p className="mt-3 text-sm font-bold text-white">{model.equation}</p>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#4ca59b] via-[#e8a23d] to-[#ed735f] transition-[width] duration-300" style={{ width: `${Math.max(4, relative * 100)}%` }} /></div>
          <p className="mt-3 text-xs leading-5 text-slate-400">Baseline: {baseline.toFixed(1)} {model.unit}. This is a simplified teaching model, not clinical decision support.</p>
          <button type="button" onClick={() => setValues({ ...model.initial })} className="mt-5 self-start rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-white hover:bg-white/10">Reset to baseline</button>
        </div>
      </div>
    </section>
  );
}
