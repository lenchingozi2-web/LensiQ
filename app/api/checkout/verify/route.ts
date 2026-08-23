import { NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase/service';
import { getPaidPlan, getWalletTopup } from '../../../../lib/plans';

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
    });
    const verifyData = await verifyResponse.json().catch(() => ({}));
    const transaction = verifyData?.data;
    const productType = String(transaction?.meta?.product_type || 'subscription');
    const verifiedAmount = Number(transaction?.amount);
    const verifiedCurrency = String(transaction?.currency || '');
    const userId = String(transaction?.meta?.user_id || '');
    const paymentReference = String(transaction?.id || transaction?.tx_ref || transactionId);
    const service = createServiceClient();

    if (productType === 'topup') {
      const topup = getWalletTopup(transaction?.meta?.product_id);
      const valid = verifyResponse.ok && verifyData.status === 'success' && transaction?.status === 'successful' && verifiedCurrency === 'NGN' && Boolean(topup) && verifiedAmount === topup?.amountNaira && Number(transaction?.meta?.voice_minutes) === topup?.voiceMinutes && Boolean(userId);
      if (!valid || !topup) throw new Error('Payment verification failed voice top-up validation.');
      const { error } = await service.rpc('settle_verified_payment', {
        p_payment_reference: `flutterwave:${paymentReference}`,
        p_user_id: userId,
        p_event_type: 'topup_payment',
        p_revenue_amount_ngn: topup.amountNaira,
        p_voice_minutes: topup.voiceMinutes,
        p_metadata: { provider: 'flutterwave', transaction_id: paymentReference, tx_ref: transaction.tx_ref, product_id: topup.id },
      });
      if (error) throw error;
      return NextResponse.redirect(new URL('/dashboard?wallet=success', req.url));
    }

    const plan = getPaidPlan(transaction?.meta?.plan_id || 'premium_monthly');
    const valid = verifyResponse.ok && verifyData.status === 'success' && transaction?.status === 'successful' && verifiedCurrency === 'NGN' && Boolean(plan) && verifiedAmount === plan?.amountNaira && Number(transaction?.meta?.plan_duration) === plan?.durationMonths && Boolean(userId);
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
    return NextResponse.redirect(new URL('/dashboard?upgrade=success', req.url));
  } catch (error) {
    console.error('Verification Error:', error);
    return NextResponse.redirect(new URL('/pricing?error=verification_failed', req.url));
  }
}
