'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PUBLIC_PAID_PLANS, WALLET_TOPUPS, type PaidPlanId, type WalletTopupId } from '@/lib/plans';

export default function PricingClient() {
  const [loading, setLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleCheckout = async (productType: 'subscription' | 'topup', id: PaidPlanId | WalletTopupId) => {
    try {
      setLoading(`${productType}:${id}`);
      setErrorMessage('');
      const body = productType === 'topup' ? { productType, productId: id } : { productType, planId: id };
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) window.location.assign(data.checkoutUrl);
      else {
        setErrorMessage(data.error || 'Failed to initialize checkout.');
        setLoading(null);
      }
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl text-center">
        <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-[#e8a23d]">Simple, transparent access</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Master medical school with <span className="text-[#e8a23d]">LenxiQ AI</span></h1>
        <p className="mx-auto mt-4 max-w-3xl text-lg text-slate-500">Learn from the full course catalogue and practical library, then use metered AI teaching and Live Class minutes when you need guided tutoring.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs font-bold text-slate-500"><span className="rounded-full border border-slate-200 bg-white px-4 py-2">Secure Flutterwave checkout</span><span className="rounded-full border border-slate-200 bg-white px-4 py-2">Full practical access on Premium</span><span className="rounded-full border border-slate-200 bg-white px-4 py-2">Top up voice minutes when needed</span></div>
      </div>

      {errorMessage && <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-800">{errorMessage}</div>}

      <div className="mx-auto mt-12 grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div><h2 className="text-2xl font-bold text-slate-900">Foundation Scholar</h2><p className="mt-2 text-sm text-slate-500">A focused free introduction to LenxiQ AI.</p><p className="mt-6 flex items-baseline gap-x-2"><span className="text-5xl font-extrabold tracking-tight text-slate-900">₦0</span><span className="font-medium text-slate-500">/ forever</span></p><ul className="mt-8 space-y-4 text-sm leading-6 text-slate-600"><li>✓ Browse one selected course</li><li>✓ 30 AI explanations/month</li><li>✓ 6 text-teaching starts/month</li><li>✓ 3 quiz attempts/month</li><li>✓ Choose one Anatomical Pathology organ/system for free practical access</li><li>✓ Live Class and voice tutoring require Hybrid Premium</li></ul></div><Link href="/dashboard" className="mt-8 block w-full rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-slate-200">Open dashboard</Link>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl"><div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[#e8a23d] opacity-20 blur-3xl" /><div className="relative"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#e8a23d]">Hybrid Premium</p><h2 className="mt-2 text-3xl font-bold text-white">Choose your subscription term</h2><p className="mt-2 text-sm text-slate-400">Both terms provide the same Premium access. The 3-month option is paid upfront and covers three monthly billing cycles.</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{PUBLIC_PAID_PLANS.map((plan) => { const isThreeMonth = plan.durationMonths === 3; return <article key={plan.id} className={`flex flex-col rounded-2xl border p-5 ${isThreeMonth ? 'border-[#e8a23d] bg-[#e8a23d]/10' : 'border-white/10 bg-white/5'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black text-white">{plan.label}</p><p className="mt-1 text-xs font-semibold text-slate-400">{isThreeMonth ? 'Three monthly cycles prepaid' : 'Billed monthly'}</p></div>{isThreeMonth && <span className="rounded-full bg-[#e8a23d] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#0b1220]">3 months</span>}</div><p className="mt-6 text-3xl font-black text-white">₦{plan.amountNaira.toLocaleString()} <span className="text-sm font-bold text-slate-300">{isThreeMonth ? 'total' : 'per month'}</span></p><p className="mt-2 min-h-10 text-xs font-semibold leading-5 text-[#ffe2a8]">50 text-teaching credits + 60 Live Class voice minutes each monthly billing cycle</p><button type="button" onClick={() => void handleCheckout('subscription', plan.id)} disabled={Boolean(loading)} className="mt-6 w-full rounded-xl bg-[#e8a23d] px-3 py-3 text-center text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-500 disabled:opacity-50">{loading === `subscription:${plan.id}` ? 'Connecting Secure Gateway…' : isThreeMonth ? 'Subscribe for 3 months' : 'Subscribe monthly'}</button></article>; })}</div><ul className="mt-8 grid gap-4 text-sm leading-6 text-slate-300 sm:grid-cols-2"><li><span className="text-[#e8a23d]">✓</span> Unlimited course browsing and learning catalogue access</li><li><span className="text-[#e8a23d]">✓</span> Unlimited AI explanations and quiz attempts</li><li><span className="text-[#e8a23d]">✓</span> Unlimited Anatomical Pathology practical systems</li><li><span className="text-[#e8a23d]">✓</span> Metered text teaching and Live Class, with prepaid top-ups available</li><li><span className="text-[#e8a23d]">✓</span> 20 MB maximum lecture file and 100 MB retained Teaching storage</li></ul></div></div>
      </div>

      <section className="mx-auto mt-10 max-w-6xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a5d00]">Prepaid Live Class wallet</p><h2 className="mt-2 text-2xl font-black text-slate-900">Top up voice minutes</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">For active Premium subscribers only. Verified Flutterwave settlement credits the wallet only after payment confirmation. Your balance is never changed by a client-side price or quantity.</p></div><Link href="/wallet" className="text-sm font-black text-[#9a5d00]">View wallet →</Link></div><div className="mt-6 grid gap-4 sm:grid-cols-3">{WALLET_TOPUPS.map((topup) => <button key={topup.id} type="button" onClick={() => void handleCheckout('topup', topup.id)} disabled={Boolean(loading)} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-[#e8a23d] hover:bg-[#fffaf0] disabled:opacity-50"><p className="text-sm font-black text-slate-900">{topup.label}</p><p className="mt-2 text-2xl font-black text-[#0b1220]">₦{topup.amountNaira.toLocaleString()}</p><p className="mt-2 text-xs font-bold text-slate-500">{loading === `topup:${topup.id}` ? 'Opening checkout…' : 'Purchase securely'}</p></button>)}</div></section>
    </div>
  );
}
