import {reconcilePendingCheckout} from '@/lib/payment-recovery';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionAccess } from '@/lib/subscription-access';
import PricingClient from './PricingClient';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let hasScheduled=false;
  let currentPlan: string | null = null;
  let accessLabel: string | null = null;
  if (user) {
    await reconcilePendingCheckout(user.id);
    await supabase.rpc('refresh_my_subscription');
    const upcoming=await supabase.from('scheduled_subscriptions').select('id',{count:'exact',head:true}).eq('user_id',user.id).eq('status','scheduled');
    hasScheduled=(upcoming.count??0)>0;
    const { data: profile } = await supabase.from('profiles')
      .select('role,plan,plan_expires_at')
      .eq('id', user.id).maybeSingle();
    if (profile) {
      const access = getSubscriptionAccess(profile);
      if (access.active) {
        accessLabel = access.admin ? 'Administrator access active' : `${access.planName} subscription active`;
        currentPlan = access.paid ? profile.plan : null;
      }
    }
  }
  return <PricingClient currentPlan={currentPlan} accessLabel={accessLabel} hasScheduled={hasScheduled} />;
}
