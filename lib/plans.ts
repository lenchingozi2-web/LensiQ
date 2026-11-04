/** The only current subscription products. Match public.subscription_plans. */
export const PAID_PLANS = [
  { id: 'scholar', durationMonths: 1, amountNaira: 4570, label: 'Scholar', aiCredits: 60, voiceMinutes: 30, mockExams: 20, sessionMinutes: 30 },
  { id: 'all_access', durationMonths: 1, amountNaira: 9870, label: 'Scholar Plus', aiCredits: 200, voiceMinutes: 90, mockExams: -1, sessionMinutes: 90 },
  { id: 'intensive', durationMonths: 1, amountNaira: 29900, label: 'Mastery', aiCredits: 600, voiceMinutes: 360, mockExams: -1, sessionMinutes: 90 },
] as const;
export const PUBLIC_PAID_PLANS = PAID_PLANS;
export type PaidPlanId = (typeof PAID_PLANS)[number]['id'];
export function getPaidPlan(id: unknown) { return PAID_PLANS.find(p => p.id === id); }
export const getPublicPaidPlan = getPaidPlan;
export function isPaidPlan(id: unknown): id is PaidPlanId { return Boolean(getPaidPlan(id)); }
export const isHybridPremiumPlan = isPaidPlan;
export const includesLiveClass = isPaidPlan;
