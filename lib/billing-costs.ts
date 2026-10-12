export const BILLING_COSTS = {
  flutterwaveFeeRate: Number(process.env.FLUTTERWAVE_FEE_RATE || 0.02),
  usdToNaira: Number(process.env.USD_TO_NGN_RATE || 1500),
  livekitAgentUsdPerVoiceMinute: Number(process.env.LIVEKIT_AGENT_USD_PER_MINUTE || 0.01),
  deepseekUsdPerTeachingRequest: Number(process.env.DEEPSEEK_USD_PER_TEACHING_REQUEST || 0.002),
} as const;

export function estimateFinancials(input: { subscriptionRevenueNaira: number; topupRevenueNaira: number; voiceMinutes: number; textTeachingCredits: number }) {
  const grossRevenueNaira = input.subscriptionRevenueNaira + input.topupRevenueNaira;
  const paymentFeesNaira = grossRevenueNaira * BILLING_COSTS.flutterwaveFeeRate;
  const voiceProviderCostUsd = input.voiceMinutes * BILLING_COSTS.livekitAgentUsdPerVoiceMinute;
  const textProviderCostUsd = input.textTeachingCredits * BILLING_COSTS.deepseekUsdPerTeachingRequest;
  const estimatedApiCostUsd = voiceProviderCostUsd + textProviderCostUsd;
  const estimatedApiCostNaira = estimatedApiCostUsd * BILLING_COSTS.usdToNaira;
  const estimatedTotalCostNaira = paymentFeesNaira + estimatedApiCostNaira;
  return {
    grossRevenueNaira,
    paymentFeesNaira,
    voiceProviderCostUsd,
    textProviderCostUsd,
    estimatedApiCostUsd,
    estimatedApiCostNaira,
    estimatedTotalCostNaira,
    estimatedNetGainNaira: grossRevenueNaira - estimatedTotalCostNaira,
  };
}
