import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { BILLING_COSTS, estimateFinancials } from '../../lib/billing-costs';
import ProviderOperationsPanel from '../../components/admin/ProviderOperationsPanel';

function naira(value: number) {
  return `₦${Math.round(value).toLocaleString('en-NG')}`;
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ data: settings }, { count: cacheCount }, { data: flaggedQuestions }, { data: summaryRows }, { data: adminStorageBytes }, { data: adminUsageEvents }] = await Promise.all([
    supabase.from('site_settings').select('is_ai_tutor_enabled, is_practical_launched').eq('id', 1).single(),
    supabase.from('question_explanations').select('*', { count: 'exact', head: true }),
    supabase.from('answer_flags').select('id, flag_reason, status, created_at, questions ( text )').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    supabase.rpc('get_admin_financial_summary'),
    supabase.rpc('get_user_teaching_storage_bytes', { p_user_id: user.id }),
    supabase.from('billing_events').select('event_type, units, created_at').eq('user_id', user.id).gte('created_at', monthStart.toISOString()).in('event_type', ['voice_charge', 'text_teaching_charge']).limit(10000),
  ]);
  const summary = Array.isArray(summaryRows) ? summaryRows[0] : summaryRows;
  const subscriptionRevenue = Number(summary?.gross_subscription_revenue_ngn ?? 0);
  const topupRevenue = Number(summary?.gross_topup_revenue_ngn ?? 0);
  const voiceMinutes = Number(summary?.voice_minutes_consumed ?? 0);
  const textCredits = Number(summary?.text_teaching_credits_consumed ?? 0);
  const financials = estimateFinancials({ subscriptionRevenueNaira: subscriptionRevenue, topupRevenueNaira: topupRevenue, voiceMinutes, textTeachingCredits: textCredits });
  const featureUsage = (summary?.feature_usage ?? {}) as Record<string, number>;
  const monthlyRevenue = Array.isArray(summary?.revenue_by_month) ? summary.revenue_by_month as Array<{ month: string; subscriptions: number; topups: number }> : [];
  const adminStorageUsed = Number(adminStorageBytes ?? 0);
  const adminStorageLimit = 100 * 1024 * 1024;
  const adminStorageRemaining = Math.max(0, adminStorageLimit - adminStorageUsed);
  const adminVoiceMinutes = (adminUsageEvents ?? []).filter((event) => event.event_type === 'voice_charge').reduce((total, event) => total + Number(event.units ?? 0), 0);
  const adminTextCredits = (adminUsageEvents ?? []).filter((event) => event.event_type === 'text_teaching_charge').reduce((total, event) => total + Number(event.units ?? 0), 0);
  const adminMonthlyCosts = estimateFinancials({ subscriptionRevenueNaira: 0, topupRevenueNaira: 0, voiceMinutes: adminVoiceMinutes, textTeachingCredits: adminTextCredits });
  const isAITutorEnabled = settings?.is_ai_tutor_enabled ?? false;
  const isPracticalLaunched = settings?.is_practical_launched ?? false;

  async function toggleAITutor() {
    'use server';
    const supabaseServer = await createClient();
    const { data: { user: actionUser } } = await supabaseServer.auth.getUser();
    const { data: actionProfile } = actionUser ? await supabaseServer.from('profiles').select('role').eq('id', actionUser.id).single() : { data: null };
    if (actionProfile?.role !== 'admin') return;
    await supabaseServer.from('site_settings').update({ is_ai_tutor_enabled: !isAITutorEnabled }).eq('id', 1);
    revalidatePath('/admin');
  }

  async function togglePracticals() {
    'use server';
    const supabaseServer = await createClient();
    const { data: { user: actionUser } } = await supabaseServer.auth.getUser();
    const { data: actionProfile } = actionUser ? await supabaseServer.from('profiles').select('role').eq('id', actionUser.id).single() : { data: null };
    if (actionProfile?.role !== 'admin') return;
    await supabaseServer.from('site_settings').update({ is_practical_launched: !isPracticalLaunched }).eq('id', 1);
    revalidatePath('/admin');
    revalidatePath('/pricing');
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[2rem] bg-gradient-to-br from-[#0b1220] via-[#17263e] to-[#243b5a] p-8 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e8a23d]">LenxiQ AI · Admin</p>
          <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Financial Intelligence Dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">A server-calculated view of cash received, measured feature usage, estimated provider spend, wallet health, and retention risk.</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm font-bold text-emerald-100">Admin access: unlimited learning and platform control · storage cap applies</div>
          </div>
        </header>

        <ProviderOperationsPanel />

        <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Gross revenue', value: naira(financials.grossRevenueNaira), detail: `${naira(subscriptionRevenue)} subscriptions · ${naira(topupRevenue)} top-ups`, tone: 'text-[#0b1220]' },
            { label: 'Estimated total cost', value: naira(financials.estimatedTotalCostNaira), detail: `${financials.estimatedApiCostUsd.toFixed(2)} USD API estimate + payment fees`, tone: 'text-amber-700' },
            { label: 'Estimated net gain', value: naira(financials.estimatedNetGainNaira), detail: 'Directional estimate; not a provider invoice', tone: financials.estimatedNetGainNaira >= 0 ? 'text-emerald-700' : 'text-red-700' },
            { label: 'Active Premium users', value: String(summary?.active_premium_users ?? 0), detail: 'Unexpired non-admin plans', tone: 'text-indigo-700' },
          ].map((card) => <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{card.label}</p><p className={`mt-3 text-3xl font-black ${card.tone}`}>{card.value}</p><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{card.detail}</p></article>)}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#9a5d00]">Revenue mix</p><h2 className="mt-2 text-xl font-black text-[#0b1220]">Subscriptions versus wallet top-ups</h2></div><p className="text-xs font-semibold text-slate-400">Last 12 months · NGN</p></div>
            <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-3 py-3">Month</th><th className="px-3 py-3">Subscriptions</th><th className="px-3 py-3">Top-ups</th><th className="px-3 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{monthlyRevenue.map((month) => <tr key={month.month}><td className="px-3 py-3 font-bold text-slate-700">{month.month}</td><td className="px-3 py-3 text-slate-600">{naira(Number(month.subscriptions))}</td><td className="px-3 py-3 text-slate-600">{naira(Number(month.topups))}</td><td className="px-3 py-3 text-right font-black text-slate-900">{naira(Number(month.subscriptions) + Number(month.topups))}</td></tr>)}</tbody></table></div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#9a5d00]">Measured consumption</p><h2 className="mt-2 text-xl font-black text-[#0b1220]">Feature usage</h2><div className="mt-6 space-y-4">{[['voice_charge', 'Voice minutes', voiceMinutes], ['text_teaching_charge', 'Text-teaching credits', textCredits], ['monthly_grant', 'Wallet grants', Number(featureUsage.monthly_grant ?? 0)]].map(([key, label, value]) => <div key={String(key)} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="text-sm font-bold text-slate-600">{String(label)}</span><span className="text-lg font-black text-[#0b1220]">{Number(value).toLocaleString()}</span></div>)}</div><p className="mt-5 text-xs leading-5 text-slate-400">Usage is based on append-only billing events, not current balances alone.</p></article>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e8a23d]/40 bg-[#fffaf0] p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#9a5d00]">Administrator usage cost</p><h2 className="mt-2 text-xl font-black text-[#0b1220]">Your estimated consumption this month</h2></div><p className="text-xs font-bold text-[#7a5a24]">Since {monthStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-white/80 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Voice</p><p className="mt-2 text-2xl font-black text-[#0b1220]">{naira(adminMonthlyCosts.voiceProviderCostUsd * BILLING_COSTS.usdToNaira)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{adminVoiceMinutes.toFixed(1)} minutes · {adminMonthlyCosts.voiceProviderCostUsd.toFixed(4)} USD</p></div><div className="rounded-xl bg-white/80 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Text teaching</p><p className="mt-2 text-2xl font-black text-[#0b1220]">{naira(adminMonthlyCosts.textProviderCostUsd * BILLING_COSTS.usdToNaira)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{adminTextCredits.toFixed(0)} credits · {adminMonthlyCosts.textProviderCostUsd.toFixed(4)} USD</p></div><div className="rounded-xl bg-white/80 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a5d00]">Total estimated cost</p><p className="mt-2 text-2xl font-black text-[#0b1220]">{naira(adminMonthlyCosts.estimatedApiCostNaira)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{adminMonthlyCosts.estimatedApiCostUsd.toFixed(4)} USD · provider estimate</p></div></div><p className="mt-4 text-xs leading-5 text-[#7a5a24]">The administrator is not charged a subscription. This total is the estimated API consumption generated by the admin’s own recorded activity, using the same configurable unit-cost assumptions as the platform margin model.</p></section>

        <section className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Global Teaching storage</p><p className="mt-3 text-2xl font-black text-[#0b1220]">{(Number(summary?.retained_teaching_storage_bytes ?? 0) / (1024 * 1024)).toFixed(1)} MB</p><p className="mt-2 text-sm font-semibold text-slate-500">Retained lecture files across all accounts</p></article>
          <article className="rounded-2xl border border-[#e8a23d]/40 bg-[#fffaf0] p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#9a5d00]">Your admin storage</p><p className="mt-3 text-2xl font-black text-[#0b1220]">{(adminStorageUsed / (1024 * 1024)).toFixed(1)} / 100 MB</p><div className="mt-3 h-2 rounded-full bg-[#eadfc9]"><div className="h-2 rounded-full bg-[#e8a23d]" style={{ width: `${Math.min(100, (adminStorageUsed / adminStorageLimit) * 100)}%` }} /></div><p className="mt-2 text-xs font-bold text-[#7a5a24]">{(adminStorageRemaining / (1024 * 1024)).toFixed(1)} MB remaining</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Recording retention</p><p className="mt-3 text-2xl font-black text-[#0b1220]">{Number(summary?.recordings_expiring_7d ?? 0)}</p><p className="mt-2 text-sm font-semibold text-slate-500">Recordings expiring within 7 days</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">System health</p><p className="mt-3 text-2xl font-black text-[#0b1220]">{flaggedQuestions?.length ?? 0} flags</p><p className="mt-2 text-sm font-semibold text-slate-500">{cacheCount ?? 0} cached explanations</p></article>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black text-slate-900">Platform controls</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{[['AI Tutor', isAITutorEnabled, toggleAITutor], ['Practicals', isPracticalLaunched, togglePracticals]].map(([label, enabled, action]) => <div key={String(label)} className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><div><p className="font-black text-slate-800">{String(label)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{enabled ? 'Active' : 'Paused'}</p></div><form action={action as () => Promise<void>}><button type="submit" className={`h-7 w-14 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-8' : 'translate-x-1'}`} /></button></form></div>)}</div></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black text-slate-900">Cost assumptions</h2><p className="mt-3 text-sm leading-6 text-slate-500">The cost model uses configurable unit assumptions for Flutterwave fees, Deepgram, LiveKit, Cartesia, and DeepSeek. It is intended for financial planning and margin monitoring, not as a replacement for provider invoices.</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold text-slate-600"><div className="rounded-xl bg-slate-50 p-3">Voice: {financials.voiceProviderCostUsd.toFixed(2)} USD</div><div className="rounded-xl bg-slate-50 p-3">Teaching: {financials.textProviderCostUsd.toFixed(2)} USD</div></div></article>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 bg-slate-50 p-6"><h2 className="text-lg font-black text-slate-900">Flagged content queue</h2></div>{!flaggedQuestions?.length ? <p className="p-8 text-center text-sm font-semibold text-slate-400">No pending flags.</p> : <ul className="divide-y divide-slate-100">{flaggedQuestions.map((flag) => <li key={flag.id} className="p-5"><p className="text-sm font-bold text-slate-800">{flag.questions && typeof flag.questions === 'object' && 'text' in flag.questions && typeof flag.questions.text === 'string' ? flag.questions.text : 'Unknown question'}</p><p className="mt-2 text-sm text-red-700">{flag.flag_reason}</p></li>)}</ul>}</section>
      </div>
    </main>
  );
}
