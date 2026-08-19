"use client";

import { useState } from 'react';
import Link from 'next/link';
import { PAID_PLANS, type PaidPlanId } from '@/lib/plans';

export default function PricingClient() {
  const [loading, setLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<PaidPlanId>('3mo');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedPlan = PAID_PLANS.find((plan) => plan.id === selectedPlanId) ?? PAID_PLANS[0];

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan.id }),
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        setErrorMessage(data.error || 'Failed to initialize checkout.');
        setLoading(false);
      }
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">Simple, transparent access</p>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
          Master Medical School with <span className="text-[#E8A23D]">LensiqAI</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-500 mx-auto">
          One premium subscription unlocks every course, practical material, explanation, quiz, and AI teaching feature.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs font-bold text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2">All paid tiers unlock everything</span>
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2">Secure Flutterwave checkout</span>
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2">Practical materials included</span>
        </div>
      </div>

      {errorMessage && <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-800">{errorMessage}</div>}

      <div className="mt-12 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Basic Trainee</h2>
            <p className="text-slate-500 mt-2 text-sm">A focused free introduction to LenxiQ.</p>
            <p className="mt-6 flex items-baseline gap-x-2">
              <span className="text-5xl font-extrabold tracking-tight text-slate-900">₦0</span>
              <span className="text-slate-500 font-medium">/ forever</span>
            </p>
            <ul className="mt-8 space-y-4 text-sm leading-6 text-slate-600">
              <li className="flex gap-x-3"><span className="text-green-500">✓</span> Access to 1 course for browsing</li>
              <li className="flex gap-x-3"><span className="text-green-500">✓</span> 30 AI explanations/month</li>
              <li className="flex gap-x-3"><span className="text-green-500">✓</span> 6 AI teaching sessions/month</li>
              <li className="flex gap-x-3"><span className="text-green-500">✓</span> 3 quiz attempts/month</li>
              <li className="flex gap-x-3 text-slate-400"><span>✕</span> Practical materials are premium-only</li>
            </ul>
          </div>
          <Link href="/dashboard" className="mt-8 block w-full bg-slate-100 text-slate-900 rounded-xl px-3 py-3 text-center text-sm font-semibold hover:bg-slate-200 transition-colors">
            Current Plan
          </Link>
        </div>

        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-[#E8A23D] rounded-full blur-3xl opacity-20" />
          <div>
            <h2 className="text-2xl font-bold text-white">Premium Scholar</h2>
            <p className="text-slate-400 mt-2 text-sm">Every paid duration unlocks the complete platform immediately.</p>

            <div className="mt-6 grid grid-cols-2 gap-4">
              {PAID_PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  aria-pressed={selectedPlanId === plan.id}
                  className={`relative p-4 rounded-xl border text-left transition-all ${
                    selectedPlanId === plan.id
                      ? 'bg-gradient-to-br from-[#E8A23D]/20 to-transparent border-[#E8A23D]/50 shadow-inner'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {plan.id === '6mo' && <span className="absolute -top-3 right-3 rounded-full bg-[#E8A23D] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-900">Most popular</span>}
                  <p className="text-xs font-medium text-slate-300">{plan.label}</p>
                  <p className="text-xl font-bold text-white mt-1">₦{plan.amountNaira.toLocaleString()}</p>
                </button>
              ))}
            </div>

            <ul className="mt-8 space-y-4 text-sm leading-6 text-slate-300">
              <li className="flex gap-x-3"><span className="text-[#E8A23D]">✓</span> Unlimited course browsing</li>
              <li className="flex gap-x-3"><span className="text-[#E8A23D]">✓</span> Unlimited AI explanations</li>
              <li className="flex gap-x-3"><span className="text-[#E8A23D]">✓</span> Unlimited AI teaching</li>
              <li className="flex gap-x-3"><span className="text-[#E8A23D]">✓</span> Unlimited quiz attempts</li>
              <li className="flex gap-x-3"><span className="text-[#E8A23D]">✓</span> All practical materials immediately</li>
            </ul>
          </div>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="mt-8 w-full bg-[#E8A23D] text-slate-900 rounded-xl px-3 py-3 text-center text-sm font-bold hover:bg-amber-500 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            {loading ? 'Connecting Secure Gateway...' : `Pay ₦${selectedPlan.amountNaira.toLocaleString()} Now`}
          </button>
        </div>
      </div>
    </div>
  );
}
