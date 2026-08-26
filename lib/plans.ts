export const PAID_PLANS = [
  { id: 'premium_monthly', durationMonths: 1, amountNaira: 6000, label: 'Monthly Premium' },
  { id: 'premium_3mo', durationMonths: 3, amountNaira: 18000, label: '3-Month Premium' },
  // Legacy terms remain valid for existing subscribers and verified renewals.
  { id: '3mo', durationMonths: 3, amountNaira: 9000, label: 'Legacy 3 Months' },
  { id: '6mo', durationMonths: 6, amountNaira: 13000, label: 'Legacy 6 Months' },
  { id: '9mo', durationMonths: 9, amountNaira: 17000, label: 'Legacy 9 Months' },
  { id: '12mo', durationMonths: 12, amountNaira: 20000, label: 'Legacy 12 Months' },
] as const;

export const PUBLIC_PAID_PLANS = [PAID_PLANS[0], PAID_PLANS[1]] as const;

export const WALLET_TOPUPS = [
  { id: 'voice_30', voiceMinutes: 30, amountNaira: 1500, label: '30 voice minutes' },
  { id: 'voice_60', voiceMinutes: 60, amountNaira: 2500, label: '60 voice minutes' },
  { id: 'voice_120', voiceMinutes: 120, amountNaira: 4500, label: '120 voice minutes' },
] as const;

export type PaidPlanId = (typeof PAID_PLANS)[number]['id'];
export type WalletTopupId = (typeof WALLET_TOPUPS)[number]['id'];

export function getPaidPlan(planId: unknown) {
  return PAID_PLANS.find((plan) => plan.id === planId);
}

export function isPaidPlan(planId: unknown): planId is PaidPlanId {
  return PAID_PLANS.some((plan) => plan.id === planId);
}

export function getWalletTopup(productId: unknown) {
  return WALLET_TOPUPS.find((product) => product.id === productId);
}

export function isHybridPremiumPlan(planId: unknown) {
  return planId === 'premium_monthly' || isPaidPlan(planId);
}
