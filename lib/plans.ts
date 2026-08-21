export const PAID_PLANS = [
  { id: '3mo', durationMonths: 3, amountNaira: 9000, label: '3 Months' },
  { id: '6mo', durationMonths: 6, amountNaira: 13000, label: '6 Months' },
  { id: '9mo', durationMonths: 9, amountNaira: 17000, label: '9 Months' },
  { id: '12mo', durationMonths: 12, amountNaira: 20000, label: '12 Months' },
] as const;

export type PaidPlanId = (typeof PAID_PLANS)[number]['id'];

export function getPaidPlan(planId: unknown) {
  return PAID_PLANS.find((plan) => plan.id === planId);
}

export function isPaidPlan(planId: unknown): planId is PaidPlanId {
  return PAID_PLANS.some((plan) => plan.id === planId);
}
