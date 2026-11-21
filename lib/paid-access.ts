import { createClient } from '@/lib/supabase/server';
export async function checkPaidAccess() {
  const subscriptionsEnabled = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';
  if (!subscriptionsEnabled) return { allowed: true, status: 200, message: 'Subscriptions are paused.' };
  const db=await createClient(); const {data,error}=await db.rpc('authorize_study_feature',{p_feature:'paid'});
  return {allowed:!error&&data?.allowed===true,status:error?503:403,message:data?.message||'A paid plan is required.'};
}
