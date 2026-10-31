import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { getPublicPaidPlan } from '../../../lib/plans';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to purchase a Premium subscription.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body?.productType === 'topup') {
      return NextResponse.json({ error: 'Pay-as-you-go voice-minute purchases are no longer available. Existing wallet minutes remain usable.' }, { status: 410 });
    }
    if (body?.productType && body.productType !== 'subscription') {
      return NextResponse.json({ error: 'Unsupported checkout product.' }, { status: 400 });
    }
    if (!process.env.FLUTTERWAVE_SECRET_KEY) return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 });

    const plan = getPublicPaidPlan(body?.planId || 'premium_monthly');
    if (!plan) return NextResponse.json({ error: 'Invalid subscription plan.' }, { status: 400 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lenxiq.online';
    const txRef = `lenxiq_subscription_${user.id}_${plan.id}_${crypto.randomUUID()}`;
    const includesLiveClass = plan.id !== 'premium_text_monthly';
    const description = `${plan.label}: ${plan.durationMonths === 1 ? 'billed monthly' : `${plan.durationMonths} monthly billing cycles prepaid`}, with 50 text-teaching credits${includesLiveClass ? ' and 6 hours of Live Class per monthly cycle' : '; Live Class is not included'}`;
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: plan.amountNaira,
        currency: 'NGN',
        redirect_url: `${siteUrl}/api/checkout/verify`,
        meta: { user_id: user.id, product_type: 'subscription', plan_id: plan.id, plan_duration: plan.durationMonths, plan_amount: plan.amountNaira },
        customer: { email: user.email, name: 'LenxiQ AI Scholar' },
        customizations: { title: 'LenxiQ AI Hybrid Premium', description, logo: `${siteUrl}/icon.png` },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success' || !data.data?.link) throw new Error(data.message || 'Payment gateway rejected the checkout request.');
    return NextResponse.json({ checkoutUrl: data.data.link, productType: 'subscription', itemId: plan.id });
  } catch (error) {
    console.error('Flutterwave API Error:', error);
    return NextResponse.json({ error: 'Failed to initialize payment gateway.' }, { status: 500 });
  }
}
