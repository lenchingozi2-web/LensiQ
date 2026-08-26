import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { getPaidPlan, getWalletTopup, isPaidPlan } from '../../../lib/plans';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'You must be logged in to purchase Premium or voice minutes.' }, { status: 401 });
    if (!process.env.FLUTTERWAVE_SECRET_KEY) return NextResponse.json({ error: 'Payments are not configured yet.' }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const productType = body?.productType === 'topup' ? 'topup' : 'subscription';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lenxiq.online';
    let amountNaira: number;
    let itemId: string;
    let meta: Record<string, string | number>;
    let description: string;
    let title: string;

    if (productType === 'topup') {
      const { data: profile } = await supabase.from('profiles').select('role, plan, plan_expires_at').eq('id', user.id).maybeSingle();
      const paidActive = profile?.role !== 'admin' && isPaidPlan(profile?.plan) && (!profile?.plan_expires_at || new Date(profile.plan_expires_at) > new Date());
      if (!paidActive) return NextResponse.json({ error: 'Voice-minute top-ups are available only to active Premium subscribers. Upgrade to Premium first.' }, { status: 403 });
      const topup = getWalletTopup(body?.productId);
      if (!topup) return NextResponse.json({ error: 'Invalid voice-minute top-up.' }, { status: 400 });
      amountNaira = topup.amountNaira;
      itemId = topup.id;
      meta = { user_id: user.id, product_type: 'topup', product_id: topup.id, voice_minutes: topup.voiceMinutes, amount_ngn: topup.amountNaira };
      description = `${topup.label} for Live Class`;
      title = 'LenxiQ AI Voice Minutes';
    } else {
      const plan = getPaidPlan(body?.planId || 'premium_monthly');
      if (!plan) return NextResponse.json({ error: 'Invalid subscription plan.' }, { status: 400 });
      amountNaira = plan.amountNaira;
      itemId = plan.id;
      meta = { user_id: user.id, product_type: 'subscription', plan_id: plan.id, plan_duration: plan.durationMonths, plan_amount: plan.amountNaira };
      description = `${plan.label}: ${plan.durationMonths === 3 ? 'three monthly billing cycles prepaid' : 'billed monthly'}, with 50 text-teaching credits and 60 voice minutes per monthly cycle`;
      title = 'LenxiQ AI Hybrid Premium';
    }

    const tx_ref = `lenxiq_${productType}_${user.id}_${itemId}_${crypto.randomUUID()}`;
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref,
        amount: amountNaira,
        currency: 'NGN',
        redirect_url: `${siteUrl}/api/checkout/verify`,
        meta,
        customer: { email: user.email, name: 'LenxiQ AI Scholar' },
        customizations: { title, description, logo: `${siteUrl}/icon.png` },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status !== 'success' || !data.data?.link) throw new Error(data.message || 'Payment gateway rejected the checkout request.');
    return NextResponse.json({ checkoutUrl: data.data.link, productType, itemId });
  } catch (error) {
    console.error('Flutterwave API Error:', error);
    return NextResponse.json({ error: 'Failed to initialize payment gateway.' }, { status: 500 });
  }
}
