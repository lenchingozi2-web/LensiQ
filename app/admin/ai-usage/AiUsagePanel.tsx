'use client';

import { useCallback, useEffect, useState } from 'react';

type MonitorData = {
  controls: {
    isPaused: boolean;
    pauseReason: string;
    globalDailyLimitUsd: number;
    globalMonthlyLimitUsd: number;
    userDailyLimitUsd: number;
    userMonthlyLimitUsd: number;
    updatedAt: string;
  };
  usage: {
    dailyReservedUsd: number;
    monthlyReservedUsd: number;
    dailyRequestCount: number;
    hourlyRequestCount: number;
    minuteRequestCount: number;
    dailyPercent: number;
    monthlyPercent: number;
  };
  recentEvents: Array<Record<string, unknown>>;
  alerts: Array<{ key: string; level: string; metric: string; observed: number; threshold: number }>;
  alertHistory: Array<Record<string, unknown>>;
  configuration: {
    serviceRoleConfigured: boolean;
    internalVoiceTokenConfigured: boolean;
    providerCallsApproved: boolean;
    alertWebhookConfigured: boolean;
  };
  generatedAt: string;
  note: string;
};

const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 3 }).format(value);
const time = (value: unknown) => typeof value === 'string' ? new Date(value).toLocaleString() : '—';
const statusClass = (ok: boolean) => ok ? 'text-emerald-700 bg-emerald-50' : 'text-amber-800 bg-amber-50';

export default function AiUsagePanel() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({ globalDailyUsd: 1, globalMonthlyUsd: 10, userDailyUsd: 0.25, userMonthlyUsd: 2 });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/admin/ai-control', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load AI usage.');
      setData(result);
      setError('');
      if (!dirty) setForm({
        globalDailyUsd: result.controls.globalDailyLimitUsd,
        globalMonthlyUsd: result.controls.globalMonthlyLimitUsd,
        userDailyUsd: result.controls.userDailyLimitUsd,
        userMonthlyUsd: result.controls.userMonthlyLimitUsd,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load AI usage.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dirty]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(true), 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      clearInterval(timer);
    };
  }, [load]);

  async function action(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const response = await fetch('/api/admin/ai-control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Action failed.');
      setNotice(success);
      setDirty(false);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function saveLimits(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action({ action: 'limits', ...form }, 'Budget limits saved.');
  }

  const missing = data ? [
    !data.configuration.serviceRoleConfigured ? 'SUPABASE_SERVICE_ROLE_KEY is missing from Vercel.' : '',
    !data.configuration.internalVoiceTokenConfigured ? 'AI_BUDGET_INTERNAL_TOKEN is missing from Vercel/Modal.' : '',
  ].filter(Boolean) : [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-7 text-white shadow-xl sm:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">LensiQ · AI operations</p>
              <h1 className="mt-3 text-3xl font-black sm:text-4xl">AI usage & emergency control</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Monitor reserved provider spend, request volume, guardrail alerts, and the global AI pause. No API keys are displayed here.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/admin" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10">← Admin dashboard</a>
              <button onClick={() => void load()} disabled={loading || busy} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-900 disabled:opacity-50">Refresh</button>
            </div>
          </div>
        </header>

        {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
        {notice && <div role="status" className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</div>}
        {missing.length > 0 && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-black text-amber-950">Monitoring setup incomplete</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{missing.map(item => <li key={item}>{item}</li>)}</ul><p className="mt-3 text-sm text-amber-900">Budget enforcement fails closed while required configuration or database tables are unavailable.</p></div>}

        {loading && !data ? <div className="mt-8 rounded-2xl bg-white p-8 font-semibold text-slate-500 shadow-sm">Loading AI budget status…</div> : data && <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Reserved today', value: usd(data.usage.dailyReservedUsd), detail: `of ${usd(data.controls.globalDailyLimitUsd)} daily cap` },
              { label: 'Reserved this month', value: usd(data.usage.monthlyReservedUsd), detail: `of ${usd(data.controls.globalMonthlyLimitUsd)} monthly cap` },
              { label: 'Requests today', value: String(data.usage.dailyRequestCount), detail: 'Shared guarded web requests' },
              { label: 'Request rate', value: `${data.usage.minuteRequestCount}/min`, detail: `${data.usage.hourlyRequestCount} in the current hour` },
            ].map(card => <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-slate-500">{card.label}</p><p className="mt-3 text-3xl font-black">{card.value}</p><p className="mt-2 text-xs font-semibold text-slate-500">{card.detail}</p></article>)}
          </section>

          <section className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs font-black uppercase tracking-widest text-slate-500">Master kill switch</p><h2 className="mt-2 text-2xl font-black">{data.controls.isPaused ? 'ALL AI PAUSED' : 'Runtime switch enabled'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{data.controls.pauseReason || 'No pause reason recorded.'}</p></div>
                <span className={`rounded-full px-3 py-2 text-xs font-black ${data.controls.isPaused ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{data.controls.isPaused ? 'SAFE · PAUSED' : 'SWITCH ON'}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button onClick={() => void action({ action: 'pause', reason: 'Emergency stop activated from LensiQ admin dashboard' }, 'Emergency stop activated. New guarded AI requests will be blocked.')} disabled={busy || data.controls.isPaused} className="rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40">⛔ Emergency stop all AI</button>
                <button onClick={() => void action({ action: 'resume' }, 'Runtime switch updated.')} disabled={busy || !data.controls.isPaused || !data.configuration.providerCallsApproved} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Resume AI (locked)</button>
              </div>
              {!data.configuration.providerCallsApproved && <p className="mt-3 text-xs font-semibold leading-5 text-amber-800">Resume is deliberately locked. AI_PROVIDER_CALLS_ENABLED is not explicitly approved, and the teaching/explanation emergency pause remains in code.</p>}
              <p className="mt-4 text-xs text-slate-500">Last control update: {time(data.controls.updatedAt)} · Turning the switch off blocks new guarded requests; it cannot cancel a provider request already in flight.</p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Budget consumption</p>
              <h2 className="mt-2 text-xl font-black">Hard spending guardrails</h2>
              {[
                { label: 'Daily', used: data.usage.dailyReservedUsd, cap: data.controls.globalDailyLimitUsd, percent: data.usage.dailyPercent },
                { label: 'Monthly', used: data.usage.monthlyReservedUsd, cap: data.controls.globalMonthlyLimitUsd, percent: data.usage.monthlyPercent },
              ].map(item => <div key={item.label} className="mt-5"><div className="flex justify-between gap-3 text-sm"><span className="font-bold">{item.label}</span><span className="font-black">{usd(item.used)} / {usd(item.cap)}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.percent >= 80 ? 'bg-red-600' : item.percent >= 50 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }} /></div><p className="mt-1 text-right text-xs font-semibold text-slate-500">{item.percent.toFixed(1)}%</p></div>)}
              <p className="mt-4 text-xs leading-5 text-slate-500">Warning at 50%; critical at 80%; the atomic reservation RPC blocks requests that would exceed the configured cap.</p>
            </article>
          </section>

          <section className="mt-6 grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Configure spending caps</h2>
              <p className="mt-1 text-sm text-slate-600">Defaults are intentionally conservative: $1/day and $10/month globally. Dollar limits are reservation estimates, not provider invoice totals.</p>
              <form onSubmit={saveLimits} className="mt-5 grid gap-4 sm:grid-cols-2">
                {([
                  ['globalDailyUsd', 'Global daily cap (USD)', 0.1, 25],
                  ['globalMonthlyUsd', 'Global monthly cap (USD)', 1, 500],
                  ['userDailyUsd', 'Per-user daily cap (USD)', 0.05, 5],
                  ['userMonthlyUsd', 'Per-user monthly cap (USD)', 0.25, 100],
                ] as const).map(([key, label, min, max]) => <label key={key} className="block text-sm font-bold text-slate-700">{label}<input type="number" min={min} max={max} step="0.05" value={form[key]} onChange={event => { setDirty(true); setForm(current => ({ ...current, [key]: Number(event.target.value) })); }} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>)}
                <div className="sm:col-span-2"><button type="submit" disabled={busy || !dirty} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save spending limits'}</button></div>
              </form>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">System readiness</h2>
              <div className="mt-4 space-y-3">
                {[
                  ['Privileged Supabase key configured', data.configuration.serviceRoleConfigured],
                  ['Internal voice budget token configured', data.configuration.internalVoiceTokenConfigured],
                  ['Paid provider calls explicitly approved', data.configuration.providerCallsApproved],
                  ['External alert webhook configured', data.configuration.alertWebhookConfigured],
                ].map(([label, ok]) => <div key={String(label)} className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-700">{label}</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(Boolean(ok))}`}>{ok ? 'READY' : 'MISSING'}</span></div>)}
              </div>
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Free API keys are not entered or stored in this panel. Keep keys out until migrations, service-role access, voice authentication, and alert delivery are verified.</p>
            </article>
          </section>

          <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6"><h2 className="text-xl font-black">Recent AI budget events</h2><p className="mt-1 text-sm text-slate-500">Operational metadata only. No prompts or API keys.</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Feature</th><th className="px-4 py-3">Model</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Reserved</th></tr></thead><tbody className="divide-y divide-slate-100">{data.recentEvents.map(event => <tr key={String(event.id)}><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{time(event.created_at)}</td><td className="px-4 py-3 font-bold">{String(event.feature || '—')}</td><td className="px-4 py-3 text-xs text-slate-600">{String(event.model || event.provider || '—')}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-black ${event.status === 'denied' || event.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{String(event.status || '—')}</span></td><td className="whitespace-nowrap px-4 py-3 text-right font-bold">{usd(Number(event.estimated_cost_microusd || 0) / 1_000_000)}</td></tr>)}</tbody></table>{data.recentEvents.length === 0 && <p className="p-6 text-sm text-slate-500">No AI usage events recorded yet. This is expected before migrations are applied and guarded calls are enabled.</p>}</div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black">Budget alerts</h2>
              <p className="mt-1 text-sm text-slate-500">Threshold crossings are recorded when this dashboard refreshes.</p>
              <div className="mt-4 space-y-3">{data.alerts.map(alert => <div key={alert.key} className={`rounded-xl border p-4 ${alert.level === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}><p className="text-xs font-black uppercase tracking-wider">{alert.level} · {alert.metric}</p><p className="mt-1 text-sm font-bold">{usd(alert.observed)} reserved against {usd(alert.threshold)} threshold</p></div>)}{data.alerts.length === 0 && <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">No current budget threshold alerts.</p>}</div>
              <h3 className="mt-6 text-sm font-black uppercase tracking-wider text-slate-500">Alert history</h3>
              <div className="mt-3 space-y-2">{data.alertHistory.slice(0, 8).map(alert => <div key={String(alert.alert_key)} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-xs"><span className="font-semibold">{String(alert.metric)} · {String(alert.level)}</span><span className="text-slate-500">{time(alert.last_seen_at)}</span></div>)}{data.alertHistory.length === 0 && <p className="mt-2 text-sm text-slate-500">No alert history yet.</p>}</div>
            </article>
          </section>

          <p className="mt-6 text-xs leading-5 text-slate-500">{data.note} Dashboard refreshed at {time(data.generatedAt)}. A kill switch blocks new guarded requests; it cannot cancel provider calls already in flight.</p>
        </>}
      </div>
    </main>
  );
}
