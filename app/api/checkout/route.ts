import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { getPaidPlan } from '../../../lib/plans';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to upgrade.' }, { status: 401 });
    }

    const body = await req.json();
    const plan = getPaidPlan(body?.planId);

    if (!plan) {
      return NextResponse.json({ error: 'Invalid subscription plan.' }, { status: 400 });
    }

    const tx_ref = `lensiq_${user.id}_${plan.id}_${Date.now()}`;
    const siteUrl = process.env.NODE_ENV === 'production'
      ? 'https://lenxiq.online'
      : 'http://localhost:3000';

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref,
        amount: plan.amountNaira,
        currency: 'NGN',
        redirect_url: `${siteUrl}/api/checkout/verify`,
        meta: {
          user_id: user.id,
          plan_id: plan.id,
          plan_duration: plan.durationMonths,
          plan_amount: plan.amountNaira,
        },
        customer: {
          email: user.email,
          name: 'lensiqAI Scholar',
        },
        customizations: {
          title: 'lensiqAI Premium Access',
          description: `${plan.label} subscription with full course and practical access`,
          logo: `${siteUrl}/icon.png`,
        },
      }),
    });

    const data = await response.json();

    if (data.status !== 'success' || !data.data?.link) {
      throw new Error(data.message || 'Payment gateway rejected the checkout request.');
    }

    return NextResponse.json({ checkoutUrl: data.data.link });
  } catch (error) {
    console.error('Flutterwave API Error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize payment gateway.' },
      { status: 500 },
    );
  }
}
