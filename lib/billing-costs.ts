export const BILLING_COSTS = {
  flutterwaveFeeRate: Number(process.env.FLUTTERWAVE_FEE_RATE || 0.02),
  usdToNaira: Number(process.env.USD_TO_NGN_RATE || 1500),
  deepgramUsdPerVoiceMinute: Number(process.env.DEEPGRAM_USD_PER_MINUTE || 0.0043),
  livekitAgentUsdPerVoiceMinute: Number(process.env.LIVEKIT_AGENT_USD_PER_MINUTE || 0.01),
  cartesiaUsdPerVoiceMinute: Number(process.env.CARTESIA_USD_PER_MINUTE || 0.004),
  deepseekUsdPerTeachingRequest: Number(process.env.DEEPSEEK_USD_PER_TEACHING_REQUEST || 0.002),
} as const;

export function estimateFinancials(input: { subscriptionRevenueNaira: number; topupRevenueNaira: number; voiceMinutes: number; textTeachingCredits: number }) {
  const grossRevenueNaira = input.subscriptionRevenueNaira + input.topupRevenueNaira;
  const paymentFeesNaira = grossRevenueNaira * BILLING_COSTS.flutterwaveFeeRate;
  const voiceProviderCostUsd = input.voiceMinutes * (BILLING_COSTS.deepgramUsdPerVoiceMinute + BILLING_COSTS.livekitAgentUsdPerVoiceMinute + BILLING_COSTS.cartesiaUsdPerVoiceMinute);
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
