import SubscriptionRefresh from '@/components/SubscriptionRefresh';
import {getPaidPlan} from '@/lib/plans';
import {reconcilePendingCheckout} from '@/lib/payment-recovery';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionAccess } from '@/lib/subscription-access';

export const dynamic = 'force-dynamic';

export default async function SubscriptionPage({searchParams}:{searchParams:Promise<{error?:string;upgrade?:string}>}) {
  const query=await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=%2Fsubscription');

  // Database entitlement is the source of truth, never localStorage or a
  // client-side flag set after checkout.
  const recovery=await reconcilePendingCheckout(user.id);
  const {error:refreshError}=await supabase.rpc('refresh_my_subscription');
  const { data: profile, error } = await supabase.from('profiles')
    .select('role,plan,plan_expires_at,voice_minutes_balance,text_teaching_balance,quiz_attempts_used')
    .eq('id', user.id).maybeSingle();
  const {data:scheduled}=await supabase.from('scheduled_subscriptions').select('id,plan_id,starts_at,ends_at').eq('user_id',user.id).eq('status','scheduled').order('starts_at').limit(10);
  const access = getSubscriptionAccess(refreshError?null:profile);
  return (
    <main className="min-h-[calc(100dvh-4.5rem)] bg-[#F6F8FB] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-[2rem] bg-gradient-to-br from-[#0B1220] to-[#233958] p-7 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#E8A23D]">LenxiQ AI · Account access</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your subscription</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Your current access is verified against your account. Refresh the page after payment to see newly activated features.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {error || refreshError || !profile ? (
              <span className="rounded-xl border border-amber-300/50 bg-amber-300/15 px-4 py-2.5 text-sm font-bold text-amber-100">Unable to confirm account access</span>
            ) : (
              <span className={`rounded-xl px-4 py-2.5 text-sm font-black ${access.active ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-800'}`}>
                {access.active ? '● Subscription active' : 'Free plan · No active subscription'}
              </span>
            )}
            <span className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold">{access.planName}</span>
          </div>
          {access.expiresAt && <p className="mt-4 text-sm text-slate-200">Valid until {new Date(access.expiresAt).toLocaleDateString('en-NG', {day:'numeric',month:'long',year:'numeric'})}</p>}
        </header>
        {error || refreshError || !profile ? <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">We could not read your subscription status. Please refresh. Your payments and access records have not been changed.</p> : null}
        <SubscriptionRefresh pending={query.error==='activation_pending'&&recovery.activated===0} />
        {recovery.activated>0&&<p className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-900">Your verified payment has been applied to your account.</p>}
        {recovery.state==='unavailable'&&<p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-900">We could not check recent payments right now. Your current verified access is shown below. Use Refresh after payment.</p>}
        {scheduled?.map(item=><p key={item.id} className="mt-4 rounded-xl border bg-white p-4">Next: {getPaidPlan(item.plan_id)?.label} from {new Date(item.starts_at).toLocaleDateString('en-NG')}. Your current benefits stay active until then.</p>)}
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Guided text tutoring</p>
            <h2 className="mt-3 text-xl font-black text-[#0B1220]">{access.textTutor ? 'Included' : 'Not included'}</h2>
            <p className="mt-2 text-sm text-slate-500">{access.admin ? 'No credit deduction for administrators' : access.paid ? `${access.textCredits ?? 0} AI responses remaining in your current cycle` : 'Choose a paid plan for AI explanations and teaching.'}</p>
            <Link href="/teach" className="mt-5 inline-flex rounded-xl bg-[#0B1220] px-4 py-3 text-sm font-bold text-white">Open Text Tutor</Link>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Interactive Live Class</p>
            <h2 className="mt-3 text-xl font-black text-[#0B1220]">{access.allAccess ? (access.admin ? 'Included · Administrator' : `${access.voiceMinutes ?? 0} minutes available`) : 'Requires a paid plan'}</h2>
            <p className="mt-2 text-sm text-slate-500">Live Class draws from your monthly minute allowance. Scholar classes last up to 30 minutes; Scholar Plus and Mastery classes last up to 90 minutes.</p>
            <Link href={access.allAccess ? '/voice?mode=class' : '/pricing'} className="mt-5 inline-flex rounded-xl bg-[#E8A23D] px-4 py-3 text-sm font-bold text-[#0B1220]">{access.allAccess ? 'Enter Live Class' : 'View plans'}</Link>
          </article>
        </section>
        <p className="mt-6 rounded-2xl border bg-white p-6 font-bold">Timed mocks: {access.mockExams === null ? 'Unlimited' : `${access.mockExams} remaining this month`}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:border-amber-300">{access.active ? 'Change or renew plan' : 'Choose a subscription'}</Link>
          <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:border-amber-300">Back to dashboard</Link>
        </div>
      </div>
    </main>
  );
}
