/** Only the literal build-time value "true" enables subscription billing. */
export function subscriptionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true';
}
