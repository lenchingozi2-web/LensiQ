import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Verify the user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to upgrade.' }, { status: 401 });
    }

    // 2. Get the requested plan duration and amount from the frontend
    const body = await req.json();
    const { amount, duration } = body;

    // 3. Create a unique transaction reference
    const tx_ref = `lensiq_${user.id}_${Date.now()}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // 4. Call Flutterwave's v3 Payment API
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref,
        amount,
        currency: 'NGN',
        redirect_url: `${siteUrl}/api/checkout/verify`, // We will build this verification route next
        meta: {
          user_id: user.id,
          plan_duration: duration,
        },
        customer: {
          email: user.email,
          name: 'LensiqAI Scholar',
        },
        customizations: {
          title: 'LensiqAI Elite Scholar',
          description: `${duration} Months Premium Subscription`,
          logo: 'https://your-logo-url-here.com/logo.png' // You can update this later
        },
      }),
    });

    const data = await response.json();

    // 5. Return the secure payment link to the frontend
    if (data.status === 'success') {
      return NextResponse.json({ checkoutUrl: data.data.link });
    } else {
      throw new Error(data.message);
    }
    
  } catch (error) {
    console.error('Flutterwave API Error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize payment gateway.' }, 
      { status: 500 }
    );
  }
}
