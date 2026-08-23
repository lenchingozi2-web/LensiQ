'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { WALLET_TOPUPS, type WalletTopupId } from '@/lib/plans';

type WalletEvent = {
  id: string;
  event_type: string;
  units: number | null;
  revenue_amount_ngn: number | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type WalletData = {
  plan: string;
  isAdmin: boolean;
  isPremium: boolean;
  planExpiresAt: string | null;
  walletResetAt: string | null;
  rollover: boolean;
  voiceMinutes: number;
  textTeachingCredits: number;
  lowVoiceBalance: boolean;
  storageUsedBytes: number;
  storageLimitBytes: number;
  events: WalletEvent[];
};

const emptyWallet: WalletData = {
  plan: 'free', isAdmin: false, isPremium: false, planExpiresAt: null, walletResetAt: null,
  rollover: false, voiceMinutes: 0, textTeachingCredits: 0, lowVoiceBalance: false,
  storageUsedBytes: 0, storageLimitBytes: 100 * 1024 * 1024, events: [],
};

function formatEvent(event: WalletEvent) {
  const labels: Record<string, string> = {
    subscription_payment: 'Premium subscription payment',
    topup_payment: 'Voice-minute top-up',
    monthly_grant: 'Monthly allowance grant',
    voice_charge: 'Live Class voice usage',
    text_teaching_charge: 'Text-teaching usage',
    storage_delete: 'Retained file deletion',
    recording_expiry: 'Recording expiry cleanup',
  };
  return labels[event.event_type] || event.event_type.replaceAll('_', ' ');
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData>(emptyWallet);
  const [loading, setLoading] = useState(true);
  const [loadingTopup, setLoadingTopup] = useState<WalletTopupId | null>(null);
  const [error, setError] = useState('');

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await fetch('/api/wallet', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || (response.status === 401 ? 'Please sign in to view your wallet.' : 'Unable to load your wallet.'));
      setLoading(false);
      return;
    }
    setWallet(body as WalletData);
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadWallet(); }, 0); return () => window.clearTimeout(timer); }, [loadWallet]);

  const startTopup = async (productId: WalletTopupId) => {
    setLoadingTopup(productId);
    setError('');
    const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productType: 'topup', productId }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.checkoutUrl) {
      setError(body.error || 'Top-up checkout could not be started.');
      setLoadingTopup(null);
      return;
    }
    window.location.assign(body.checkoutUrl);
  };

  const storagePercent = Math.min(100, Math.round((wallet.storageUsedBytes / Math.max(wallet.storageLimitBytes, 1)) * 100));
  const paidLabel = loading ? 'Checking access…' : wallet.isAdmin ? 'Administrator access' : wallet.isPremium ? 'Hybrid Premium' : 'Foundation Scholar';

  return <main className="min-h-screen bg-[#f6f7fb] px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><Link href="/dashboard" className="text-sm font-black text-slate-500 hover:text-[#0B1220]">← Back to dashboard</Link><header className="mt-6 rounded-[2rem] bg-[#0B1220] p-7 text-white shadow-xl sm:p-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#E8A23D]">Authenticated wallet</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your learning wallet</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">This is the live server-backed balance used to authorize text teaching and Live Class. Verified payments, monthly grants, and usage charges are recorded in the history below.</p></div><span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-[#FFE2A8]">{paidLabel}</span></div></header>{error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div>}{loading ? <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-500">Loading your wallet…</div> : <><section className="mt-6 grid gap-5 md:grid-cols-3"><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Live Class voice minutes</p><p className="mt-3 text-4xl font-black text-[#0B1220]">{wallet.isAdmin ? 'Unlimited' : wallet.voiceMinutes}</p><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{wallet.isAdmin ? 'Administrator sessions are unmetered.' : wallet.lowVoiceBalance ? 'Low balance: at or below 5 minutes.' : 'Session access ends gracefully when this balance reaches zero.'}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Text-teaching credits</p><p className="mt-3 text-4xl font-black text-[#0B1220]">{wallet.isAdmin ? 'Unlimited' : wallet.textTeachingCredits}</p><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{wallet.isAdmin ? 'Administrator usage is recorded but never deducted.' : 'Premium monthly credits reset to 50; unused credits do not roll over.'}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Retained Teaching storage</p><p className="mt-3 text-3xl font-black text-[#0B1220]">{formatBytes(wallet.storageUsedBytes)} <span className="text-base text-slate-400">/ {formatBytes(wallet.storageLimitBytes)}</span></p><div className="mt-4 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${storagePercent >= 90 ? 'bg-red-500' : 'bg-[#E8A23D]'}`} style={{ width: `${storagePercent}%` }} /></div><Link href="/files" className="mt-3 inline-flex text-xs font-black text-[#9A5D00]">Manage retained files →</Link></article></section><section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#9A5D00]">Wallet history</p><h2 className="mt-2 text-xl font-black text-[#0B1220]">Verified grants and measured usage</h2></div><button type="button" onClick={() => void loadWallet()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">Refresh</button></div>{wallet.events.length === 0 ? <p className="mt-8 rounded-xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">No wallet events have been recorded yet.</p> : <ul className="mt-5 divide-y divide-slate-100">{wallet.events.map((event) => <li key={event.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black capitalize text-slate-800">{formatEvent(event)}</p><p className="mt-1 text-xs font-semibold text-slate-400">{new Date(event.created_at).toLocaleString()}</p></div><div className="text-left sm:text-right"><p className={`text-sm font-black ${event.event_type.includes('charge') ? 'text-red-700' : 'text-emerald-700'}`}>{event.event_type.includes('charge') ? '−' : '+'}{event.units ?? 0} {event.event_type.includes('text') ? 'credits' : 'minutes/units'}</p>{Number(event.revenue_amount_ngn) > 0 && <p className="mt-1 text-xs font-semibold text-slate-400">₦{Number(event.revenue_amount_ngn).toLocaleString()}</p>}</div></li>)}</ul>}</article><aside className="space-y-6"><article className="rounded-2xl border border-[#E8A23D]/40 bg-[#FFF8E9] p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#9A5D00]">Billing access</p><h2 className="mt-2 text-xl font-black text-[#0B1220]">{wallet.isPremium ? 'Top up voice minutes' : wallet.isAdmin ? 'Administrator wallet' : 'Activate your wallet with Premium'}</h2>{wallet.isAdmin ? <p className="mt-3 text-sm font-semibold leading-6 text-[#6E501E]">Administrators have unlimited Live Class access and do not need to purchase top-ups. Admin usage is tracked internally for cost intelligence.</p> : wallet.isPremium ? <><p className="mt-3 text-sm font-semibold leading-6 text-[#6E501E]">Top-ups are available only while your Premium plan is active. Flutterwave verification credits this server-side balance; the client cannot grant minutes.</p><div className="mt-5 grid gap-3">{WALLET_TOPUPS.map((topup) => <button key={topup.id} type="button" onClick={() => void startTopup(topup.id)} disabled={Boolean(loadingTopup)} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-left text-sm font-black text-[#0B1220] shadow-sm hover:bg-[#FFFDF7] disabled:opacity-60"><span>{topup.label}</span><span>₦{topup.amountNaira.toLocaleString()}</span></button>)}</div></> : <><p className="mt-3 text-sm font-semibold leading-6 text-[#6E501E]">Foundation Scholar does not have Live Class access or voice top-ups. Upgrade to Hybrid Premium to activate the wallet and receive 60 monthly voice minutes.</p><Link href="/pricing" className="mt-5 inline-flex rounded-xl bg-[#0B1220] px-4 py-3 text-sm font-black text-white">View Premium plan</Link></>}</article><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Billing cycle</p><p className="mt-3 text-sm font-bold text-slate-700">{wallet.isAdmin ? 'Not applicable to administrators' : wallet.walletResetAt ? `Next reset: ${new Date(wallet.walletResetAt).toLocaleDateString()}` : 'Activated after Premium payment'}</p><p className="mt-2 text-xs leading-5 text-slate-500">Monthly voice and text allowances reset to 60 minutes and 50 credits on the billing date. Unused monthly allowances do not roll over.</p></article></aside></section></>}</div></main>;
}
