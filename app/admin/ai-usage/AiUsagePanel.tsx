'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ServiceStatus = {
  checkedAt: string;
  services: { textTutor: boolean; liveKit: boolean; voiceWorker: 'external' };
};

export default function AiUsagePanel() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const run = ++requestRef.current;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/ai-health?refresh=${Date.now()}`, {
        cache: 'no-store', credentials: 'same-origin',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.error || 'Unable to check AI services.');
      if (requestRef.current !== run) return;
      setStatus(result as ServiceStatus);
      setRefreshCount(n => n + 1);
    } catch (err) {
      if (requestRef.current === run) setError(err instanceof Error ? err.message : 'Refresh failed.');
    } finally {
      if (requestRef.current === run) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => { requestRef.current += 1; };
  }, [refresh]);

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-4xl">
      <header className="rounded-3xl bg-slate-950 p-7 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-300">LenxiQ · Administration</p>
        <h1 className="mt-3 text-3xl font-black">AI service status</h1>
        <p className="mt-3 text-sm text-slate-300">Current configuration signals for medical tutoring and Live Class.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/admin" className="rounded-xl border border-white/25 px-4 py-2 font-bold">← Admin dashboard</a>
          <button type="button" onClick={() => void refresh()} disabled={loading}
            aria-busy={loading}
            className="rounded-xl bg-white px-4 py-2 font-black text-slate-950 disabled:opacity-60">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>
      <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-600">
        {loading ? 'Checking current service status…' : status ?
          `Refreshed ${refreshCount} time(s). Last checked ${new Date(status.checkedAt).toLocaleString()}.` :
          'No status has been loaded yet.'}
      </p>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
      {status && <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border bg-white p-6">
          <h2 className="font-bold">Text Tutor provider</h2>
          <p className="mt-2 text-xl font-black">{status.services.textTutor ? 'Configured' : 'Not configured'}</p>
          <p className="mt-2 text-sm text-slate-500">Configuration only, not a successful model-response test.</p>
        </article>
        <article className="rounded-2xl border bg-white p-6">
          <h2 className="font-bold">LiveKit classroom</h2>
          <p className="mt-2 text-xl font-black">{status.services.liveKit ? 'Configured' : 'Not configured'}</p>
          <p className="mt-2 text-sm text-slate-500">The external Modal worker must be checked separately.</p>
        </article>
      </div>}
    </div>
  </main>;
}
