'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function PracticalFreeChoice({ system, selectedSystem }: { system: string; selectedSystem?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSelected = Boolean(selectedSystem && selectedSystem.toLowerCase() === system.toLowerCase());
  const hasSelection = Boolean(selectedSystem);

  if (isSelected) return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">Your free system</span>;
  if (hasSelection) return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Premium</span>;

  const choose = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/practical/free-selection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error || 'Unable to save your choice.'); return; }
      router.refresh();
    } catch { setError('Unable to save your choice. Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  return <div className="flex flex-col items-end gap-2"><button type="button" onClick={() => void choose()} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Saving…' : 'Choose as free'}</button>{error && <span className="max-w-32 text-right text-[10px] font-bold leading-4 text-red-700">{error}</span>}</div>;
}
