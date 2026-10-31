'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PUBLIC_PAID_PLANS, type PaidPlanId } from '@/lib/plans';

export default function PricingClient() {
  const [loading, setLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleCheckout = async (planId: PaidPlanId) => {
    try {
      setLoading(planId);
      setErrorMessage('');
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productType: 'subscription', planId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      setErrorMessage(data.error || 'Secure checkout could not be started.');
      setLoading(null);
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto max-w-4xl text-center">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-[#9a5d00]">Simple, transparent access</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Study with a plan. <span className="text-[#c9811e]">Learn with LenxiQ AI.</span></h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">One AI Tutor, in voice or visual Live Class mode. Choose the access level that fits your study routine.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 text-xs font-bold text-slate-600">
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2">Secure Flutterwave checkout</span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2">Interactive Live Class is exclusive to All Access</span>
            <span className="rounded-full border border-slate-200 bg-white px-4 py-2">Existing wallet minutes remain usable</span>
          </div>
        </header>

        {errorMessage && <div role="alert" className="mx-auto mt-8 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-800">{errorMessage}</div>}

        <div className="mx-auto mt-10 grid max-w-7xl gap-6 xl:grid-cols-[0.78fr_1.62fr]">
          <section className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9a5d00]">Start free</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Foundation Scholar</h2>
              <p className="mt-2 text-sm text-slate-500">A focused introduction to the LenxiQ study hub.</p>
              <p className="mt-6 flex items-baseline gap-x-2"><span className="text-5xl font-extrabold tracking-tight text-slate-900">₦0</span><span className="font-medium text-slate-500">/ forever</span></p>
              <ul className="mt-7 space-y-3 text-sm leading-6 text-slate-600">
                <li>✓ Browse one selected course</li>
                <li>✓ 30 AI explanations per month</li>
                <li>✓ 6 text-teaching starts per month</li>
                <li>✓ 3 quiz attempts per month</li>
                <li>✓ Text-based study tools (Live Class not included)</li>
                <li>✓ One free Anatomical Pathology organ/system</li>
              </ul>
            </div>
            <Link href="/dashboard" className="mt-8 block w-full rounded-xl bg-slate-100 px-3 py-3 text-center text-sm font-bold text-slate-900 hover:bg-slate-200">Open dashboard</Link>
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-[#e8a23d] opacity-20 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e8a23d]">Premium access</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Choose your subscription term</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Choose focused study access or unlock the complete LenxiQ experience with interactive Live Class. Allowances refresh each billing cycle.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {PUBLIC_PAID_PLANS.map((plan) => {
                  const isLiveClassPlan = plan.id === 'premium_monthly';
                  const prepaid = plan.durationMonths > 1;
                  const monthlyEquivalent = Math.round(plan.amountNaira / plan.durationMonths);
                  return (
                    <article key={plan.id} className={`flex flex-col rounded-2xl border p-5 ${isLiveClassPlan ? 'border-[#e8a23d] bg-[#e8a23d]/10 shadow-[0_0_0_1px_rgba(232,162,61,0.18)]' : 'border-white/10 bg-white/5'}`}>
                      <div className="flex min-h-12 items-start justify-between gap-2">
                        <div><p className="text-lg font-black text-white">{plan.label}</p><p className="mt-1 text-xs font-semibold text-slate-400">{prepaid ? `${plan.durationMonths} monthly cycles prepaid` : 'Billed monthly'}</p></div>
                        {isLiveClassPlan && <span className="shrink-0 rounded-full bg-[#e8a23d] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#0b1220]">Live Class</span>}
                      </div>
                      <p className="mt-5 text-3xl font-black text-white">₦{plan.amountNaira.toLocaleString()} <span className="text-sm font-bold text-slate-300">{prepaid ? 'total' : 'per month'}</span></p>
                      {prepaid && <p className="mt-1 text-xs font-semibold text-slate-400">₦{monthlyEquivalent.toLocaleString()} per month equivalent</p>}
                      <p className="mt-4 min-h-12 text-xs font-semibold leading-5 text-[#ffe2a8]">{isLiveClassPlan ? 'All catalogue, practical systems, text tutoring, and 6 hours of Live Class each month.' : 'All catalogue, practical systems, AI explanations, quizzes, and 50 text-teaching credits each month. Live Class is not included.'}</p>
                      <button type="button" onClick={() => void handleCheckout(plan.id)} disabled={Boolean(loading)} className="mt-auto w-full rounded-xl bg-[#e8a23d] px-3 py-3 text-center text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-500 disabled:opacity-50">
                        {loading === plan.id ? 'Connecting secure gateway…' : prepaid ? `Subscribe for ${plan.durationMonths} months` : 'Subscribe monthly'}
                      </button>
                    </article>
                  );
                })}
              </div>
              <ul className="mt-7 grid gap-3 text-sm leading-6 text-slate-300 sm:grid-cols-2">
                <li><span className="text-[#e8a23d]">✓</span> Unlimited course browsing and catalogue access</li>
                <li><span className="text-[#e8a23d]">✓</span> Unlimited AI explanations and quiz attempts</li>
                <li><span className="text-[#e8a23d]">✓</span> Unlimited Anatomical Pathology practical systems</li>
                <li><span className="text-[#e8a23d]">✓</span> Voice and visual tutoring included with All Access</li>
                <li><span className="text-[#e8a23d]">✓</span> Monthly allowances; no additional voice-minute purchases</li>
                <li><span className="text-[#e8a23d]">✓</span> 20 MB lecture files and 100 MB retained Teaching storage</li>
              </ul>
            </div>
          </section>
        </div>

        <p className="mx-auto mt-8 max-w-4xl text-center text-xs leading-5 text-slate-500">Any Live Class minutes already in your wallet remain available until used. Additional pay-as-you-go voice-minute purchases are no longer offered.</p>
      </div>
    </main>
  );
}
