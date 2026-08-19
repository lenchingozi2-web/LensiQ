import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { getPaidPlan } from '../../../../lib/plans';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const transactionId = searchParams.get('transaction_id');

    if (!transactionId || (status !== 'successful' && status !== 'completed')) {
      return NextResponse.redirect(new URL('/pricing?error=payment_failed', req.url));
    }

    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const verifyData = await verifyResponse.json();
    const transaction = verifyData?.data;
    const plan = getPaidPlan(transaction?.meta?.plan_id);
    const verifiedAmount = Number(transaction?.amount);
    const verifiedCurrency = transaction?.currency;

    const isValid = verifyResponse.ok
      && verifyData.status === 'success'
      && transaction?.status === 'successful'
      && verifiedCurrency === 'NGN'
      && Boolean(plan)
      && verifiedAmount === plan?.amountNaira
      && Number(transaction?.meta?.plan_duration) === plan?.durationMonths;

    if (!isValid || !plan) {
      throw new Error('Payment verification failed plan validation.');
    }

    const userId = transaction.meta.user_id;
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + plan.durationMonths);

    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        plan: plan.id,
        plan_duration: plan.durationMonths,
        plan_expires_at: expirationDate.toISOString(),
        ai_explanations_used: 0,
        ai_teachings_used: 0,
        quiz_attempts_used: 0,
      })
      .eq('id', userId);

    if (error) throw error;

    return NextResponse.redirect(new URL('/dashboard?upgrade=success', req.url));
  } catch (error) {
    console.error('Verification Error:', error);
    return NextResponse.redirect(new URL('/pricing?error=verification_failed', req.url));
  }
}
