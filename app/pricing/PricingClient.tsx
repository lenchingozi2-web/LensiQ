"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function PricingClient({ isPracticalLaunched }: { isPracticalLaunched: boolean }) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState({ duration: 3, amount: 6000 });

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedPlan),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl; 
      else { alert(data.error || "Failed checkout."); setLoading(false); }
    } catch (error) {
      alert("Something went wrong."); setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
          Master Medical School with <span className="text-[#E8A23D]">LensiqAI</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-500 mx-auto">
          Upgrade to unlock unlimited AI teaching, explanations, and every medical course.
        </p>
      </div>

      <div className="mt-16 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Free Tier */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Basic Trainee</h2>
            <p className="text-slate-500 mt-2 text-sm">Perfect for testing the waters.</p>
            <p className="mt-6 flex items-baseline gap-x-2">
              <span className="text-5xl font-extrabold tracking-tight text-slate-900">₦0</span>
              <span className="text-slate-500 font-medium">/ forever</span>
            </p>
            <ul className="mt-8 space-y-4 text-sm leading-6 text-slate-600">
              <li className="flex gap-x-3"><span className="text-green-500">✓</span> Access to 1 Course (Browse Only)</li>
              <li className="flex gap-x-3"><span className="text-green-500">✓</span> 30 AI Explanations/month</li>
              <li className="flex gap-x-3"><span className="text-green-500">✓</span> 6 AI Teaching sessions/month</li>
              <li className="flex gap-x-3"><span className="text-green-500">✓</span> 3 Quiz attempts/month</li>
              <li className={`flex gap-x-3 ${isPracticalLaunched ? 'text-slate-600' : 'text-slate-400'}`}>
                <span>✕</span> Practical Materials (Premium Only)
              </li>
            </ul>
          </div>
          <Link href="/dashboard" className="mt-8 block w-full bg-slate-100 text-slate-900 rounded-xl px-3 py-3 text-center text-sm font-semibold hover:bg-slate-200 transition-colors">
            Current Plan
          </Link>
        </div>

        {/* Premium Tier */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-[#E8A23D] rounded-full blur-3xl opacity-20"></div>
          <div>
            <h2 className="text-2xl font-bold text-white">Elite Scholar</h2>
            <p className="text-slate-400 mt-2 text-sm">Unlimited access. Zero restrictions.</p>
            
            <div className="mt-6 grid grid-cols-2 gap-4">
              {[
                { duration: 3, amount: 6000, label: '3 Months', locked: false },
                { duration: 6, amount: 8000, label: '6 Months', locked: false },
                { duration: 9, amount: 10000, label: '9 Months', locked: false },
                { duration: 12, amount: 12000, label: '12 Months', locked: !isPracticalLaunched } // DYNAMIC LOCK
              ].map((plan) => (
                <button 
                  key={plan.duration}
                  disabled={plan.locked}
                  onClick={() => !plan.locked && setSelectedPlan({ duration: plan.duration, amount: plan.amount })}
                  className={`p-4 rounded-xl border relative text-left transition-all ${
                    plan.locked 
                    ? 'opacity-40 cursor-not-allowed bg-slate-800/20 border-slate-800' 
                    : selectedPlan.duration === plan.duration 
                      ? 'bg-gradient-to-br from-[#E8A23D]/20 to-transparent border-[#E8A23D]/50 shadow-inner' 
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {plan.duration === 12 && !isPracticalLaunched && (
                    <span className="absolute top-0 right-0 bg-slate-700 text-slate-300 text-[9px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg">
                      COMING SOON
                    </span>
                  )}
                  {plan.duration === 12 && isPracticalLaunched && (
                    <span className="absolute top-0 right-0 bg-[#E8A23D] text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg">
                      BEST VALUE + PRACTICALS
                    </span>
                  )}
                  <p className={`${selectedPlan.duration === plan.duration ? 'text-slate-300' : 'text-slate-400'} text-xs font-medium`}>{plan.label}</p>
                  <p className="text-xl font-bold text-white mt-1">₦{plan.amount.toLocaleString()}</p>
                </button>
              ))}
            </div>

            <ul className="mt-8 space-y-4 text-sm leading-6 text-slate-300">
              <li className="flex gap-x-3"><span className="text-[#E8A23D]">✓</span> <strong className="text-white">Unlimited</strong> Course Browsing</li>
              <li className="flex gap-x-3"><span className="text-[#E8A23D]">✓</span> <strong className="text-white">Unlimited</strong> AI Explanations</li>
              <li className="flex gap-x-3"><span className="text-[#E8A23D]">✓</span> <strong className="text-white">Unlimited</strong> AI Teaching</li>
              <li className="flex gap-x-3"><span className="text-[#E8A23D]">✓</span> <strong className="text-white">Unlimited</strong> Quiz Attempts</li>
              <li className="flex gap-x-3 text-slate-400">
                <span className="text-slate-500">{isPracticalLaunched ? '✓' : '🔒'}</span> 
                <span className={isPracticalLaunched ? 'text-white font-medium' : ''}>
                  Practical Materials {isPracticalLaunched ? '(Unlocked with 12-Month)' : '(Unlocks on launch)'}
                </span>
              </li>
            </ul>
          </div>
          
          <button 
            onClick={handleUpgrade}
            disabled={loading}
            className={`mt-8 w-full bg-[#E8A23D] text-slate-900 rounded-xl px-3 py-3 text-center text-sm font-bold hover:bg-amber-500 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50`}
          >
            {loading ? 'Connecting Secure Gateway...' : `Pay ₦${selectedPlan.amount.toLocaleString()} Now`}
          </button>
        </div>
      </div>
    </div>
  );
}
