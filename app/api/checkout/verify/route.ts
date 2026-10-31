import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase/service';
import { getPaidPlan } from '../../../../lib/plans';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const transactionId = searchParams.get('transaction_id');
    if (!transactionId || (status !== 'successful' && status !== 'completed')) return NextResponse.redirect(new URL('/pricing?error=payment_failed', req.url));
    if (!process.env.FLUTTERWAVE_SECRET_KEY) throw new Error('Flutterwave is not configured.');

    const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const verifyData = await verifyResponse.json().catch(() => ({}));
    const transaction = verifyData?.data;
    const productType = String(transaction?.meta?.product_type || 'subscription');
    const verifiedAmount = Number(transaction?.amount);
    const verifiedCurrency = String(transaction?.currency || '');
    const userId = String(transaction?.meta?.user_id || '');
    const paymentReference = String(transaction?.id || transaction?.tx_ref || transactionId);
    const service = createServiceClient();

    if (productType === 'topup') throw new Error('Voice-minute top-ups are no longer supported.');

    const plan = getPaidPlan(transaction?.meta?.plan_id || 'premium_monthly');
    // Never activate access from query parameters alone. Check the Flutterwave
    // transaction, the purchased plan, and its server-generated checkout ref.
    const txRef = typeof transaction?.tx_ref === 'string' ? transaction.tx_ref : '';
    const expectedPrefix = `lenxiq_subscription_${userId}_${plan?.id ?? ''}_`;
    const validRef = txRef.startsWith(expectedPrefix)
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(txRef.slice(expectedPrefix.length));
    const valid = verifyResponse.ok && verifyData.status === 'success'
      && transaction?.status === 'successful'
      && verifiedCurrency === 'NGN' && Boolean(plan)
      && Number.isFinite(verifiedAmount) && verifiedAmount === plan?.amountNaira
      && Number(transaction?.meta?.plan_duration) === plan?.durationMonths
      && Boolean(userId) && validRef;
    if (!valid || !plan) throw new Error('Payment verification failed subscription validation.');

    const { error } = await service.rpc('settle_verified_payment', {
      p_payment_reference: `flutterwave:${paymentReference}`,
      p_user_id: userId,
      p_event_type: 'subscription_payment',
      p_plan_id: plan.id,
      p_plan_duration: plan.durationMonths,
      p_revenue_amount_ngn: plan.amountNaira,
      p_metadata: { provider: 'flutterwave', transaction_id: paymentReference, tx_ref: transaction.tx_ref, plan_id: plan.id },
    });
    if (error) throw error;
    // A successful gateway response does not guarantee the subscriber was
    // provisioned. Confirm their ACTIVE plan before saying "activated".
    const { data: profile, error: profileError } = await service
      .from('profiles').select('plan,plan_expires_at')
      .eq('id', userId).maybeSingle();
    if (profileError || !profile || profile.plan !== plan.id ||
      (profile.plan_expires_at && Date.parse(profile.plan_expires_at) <= Date.now())) {
      console.error('Verified payment was not reflected in subscriber entitlement');
      return NextResponse.redirect(new URL('/pricing?error=activation_pending', req.url));
    }
    return NextResponse.redirect(new URL('/subscription?upgrade=success', req.url));
  } catch (error) {
    console.error('Verification Error:', error);
    return NextResponse.redirect(new URL('/pricing?error=verification_failed', req.url));
  }
}
