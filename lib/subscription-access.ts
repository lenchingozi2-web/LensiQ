import { getPaidPlan } from '@/lib/plans';
export type SubscriptionProfile = {
  role?: string | null; plan?: string | null; plan_expires_at?: string | null;
  voice_minutes_balance?: number | null; text_teaching_balance?: number | null;
  quiz_attempts_used?: number | null;
};
export function getSubscriptionAccess(profile: SubscriptionProfile | null | undefined, now = Date.now()) {
  const admin = profile?.role === 'admin';
  const product = getPaidPlan(profile?.plan);
  const paid = Boolean(product && profile?.plan_expires_at && Date.parse(profile.plan_expires_at) > now);
  const subscriptionsEnabled = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';
  const active = subscriptionsEnabled ? (admin || paid) : true;
  return {
    admin, active, paid: subscriptionsEnabled ? paid : true, allAccess: active, textTutor: active,
    planName: subscriptionsEnabled ? (admin ? 'Administrator' : paid ? product!.label : 'Explorer') : 'Full Access',
    expiresAt: !subscriptionsEnabled ? null : (admin || !paid ? null : profile?.plan_expires_at || null),
    voiceMinutes: subscriptionsEnabled ? (admin ? null : paid ? Math.max(0, Number(profile?.voice_minutes_balance ?? 0)) : 0) : null,
    textCredits: subscriptionsEnabled ? (admin ? null : paid ? Math.max(0, Number(profile?.text_teaching_balance ?? 0)) : 0) : null,
    mockExams: subscriptionsEnabled ? (admin || (paid && product!.mockExams===-1) ? null : Math.max(0,(paid ? product!.mockExams : 3)-Number(profile?.quiz_attempts_used??0))) : null,
    sessionMinutes: subscriptionsEnabled ? (admin ? null : paid ? product!.sessionMinutes : 0) : null,
  };
}
