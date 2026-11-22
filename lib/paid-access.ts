import { createClient } from '@/lib/supabase/server';
export async function checkPaidAccess() {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { allowed: false, status: 401, message: 'Sign in to continue.' };
    if (process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED !== 'true') {
      return { allowed: true, status: 200, message: 'Full Access Enabled' };
    }
    const { data, error } = await db.rpc('authorize_study_feature', { p_feature: 'paid' });
    const allowed = !error && data?.allowed === true;
    return { allowed, status: error ? 503 : allowed ? 200 : 403, message: data?.message || (allowed ? 'Access granted.' : 'A paid plan is required.') };
  } catch {
    return { allowed: false, status: 503, message: 'Unable to verify your access. Please try again.' };
  }
}
