'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProviderStatus } from '@/lib/provider-status';

type ResponseBody = { checkedAt?: string; providers?: ProviderStatus[]; error?: string };

function money(value: number, units: string | null) {
  return `${units === 'USD' ? '$' : ''}${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${units && units !== 'USD' ? units : ''}`.trim();
}

export default function ProviderOperationsPanel() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await fetch('/api/admin/provider-status', { cache: 'no-store' });
    const body = await response.json().catch(() => ({})) as ResponseBody;
    if (!response.ok) {
      setError(body.error || 'Provider status could not be loaded.');
      setLoading(false);
      return;
    }
    setProviders(body.providers ?? []);
    setCheckedAt(body.checkedAt ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, [refresh]);

  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#9a5d00]">Provider operations</p><h2 className="mt-2 text-xl font-black text-[#0b1220]">Live account status and billing access</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Only administrators can access this panel. Values come from provider APIs when their account permissions and plan expose them; unavailable values are never replaced with guesses.</p></div><div className="flex items-center gap-3"><p className="text-xs font-semibold text-slate-400">{checkedAt ? `Checked ${new Date(checkedAt).toLocaleTimeString()}` : 'Not checked'}</p><button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">{loading ? 'Checking…' : 'Refresh'}</button></div></div>{error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p>}<div className="mt-6 grid gap-4 md:grid-cols-2">{providers.map((provider) => <article key={provider.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-black text-[#0b1220]">{provider.name}</h3><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${provider.state === 'live' ? 'bg-emerald-100 text-emerald-800' : provider.state === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{provider.state === 'live' ? 'Live data' : provider.state === 'error' ? 'Provider error' : 'Unavailable'}</span></div><div className="flex gap-3 text-xs font-black"><a href={provider.billingUrl} target="_blank" rel="noreferrer" className="text-[#9a5d00] hover:underline">Billing</a><a href={provider.docsUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:underline">Docs</a></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{provider.message}</p>{provider.balance && provider.balance.length > 0 && <div className="mt-4 space-y-2">{provider.balance.map((balance, index) => <div key={`${provider.id}-balance-${index}`} className="rounded-xl bg-white px-4 py-3"><p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{balance.label || 'Current balance'}</p><p className="mt-1 text-xl font-black text-[#0b1220]">{balance.amount == null || Number.isNaN(balance.amount) ? 'Unavailable' : money(balance.amount, balance.units)}</p></div>)}</div>}{provider.usage && provider.usage.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{provider.usage.map((item) => <div key={`${provider.id}-${item.label}`} className="rounded-xl bg-white px-4 py-3"><p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{item.label}</p><p className="mt-1 text-lg font-black text-[#0b1220]">{item.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400">{item.unit}</span></p></div>)}</div>}{provider.state !== 'live' && <a href={provider.billingUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg bg-[#0b1220] px-3 py-2 text-xs font-black text-white hover:bg-slate-800">Open provider billing console</a>}</article>)}</div><p className="mt-5 text-xs leading-5 text-slate-400">This panel provides monitoring and links to provider billing consoles. It does not store provider passwords, API secrets, or payment-card details, and it does not subscribe or pay for a plan automatically.</p></section>;
}
