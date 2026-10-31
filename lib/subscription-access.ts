import { includesLiveClass, isPaidPlan } from '@/lib/plans';

export type SubscriptionProfile = {
  role?: string | null;
  plan?: string | null;
  plan_expires_at?: string | null;
  voice_minutes_balance?: number | null;
  text_teaching_balance?: number | null;
};

export function getSubscriptionAccess(profile: SubscriptionProfile | null | undefined, now = Date.now()) {
  const admin = profile?.role === 'admin';
  const paid = isPaidPlan(profile?.plan) && (
    !profile?.plan_expires_at || (
      Number.isFinite(Date.parse(profile.plan_expires_at)) &&
      Date.parse(profile.plan_expires_at) > now
    )
  );
  const allAccess = admin || (paid && includesLiveClass(profile?.plan));
  const textTutor = admin || paid;
  const active = admin || paid;
  const planName = admin ? 'Administrator' :
    !paid ? 'Free Study' :
      allAccess ? 'All Access' : 'Premium Study';

  return {
    admin, active, paid, allAccess, textTutor, planName,
    expiresAt: admin || !paid ? null : profile?.plan_expires_at || null,
    voiceMinutes: admin ? null : Math.max(0, Number(profile?.voice_minutes_balance ?? 0)),
    textCredits: admin ? null : Math.max(0, Number(profile?.text_teaching_balance ?? 0)),
  };
}
