import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const transaction_id = searchParams.get('transaction_id');
    const tx_ref = searchParams.get('tx_ref');

    // 1. If payment failed or was cancelled, send them back to pricing
    if (status !== 'successful' && status !== 'completed') {
      return NextResponse.redirect(new URL('/pricing?error=payment_failed', req.url));
    }

    // 2. Verify the actual transaction securely with Flutterwave
    const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.status === 'success' && verifyData.data.status === 'successful') {
      const supabase = await createClient();
      
      // Extract the data we embedded during checkout
      const userId = verifyData.data.meta.user_id;
      const durationInMonths = Number(verifyData.data.meta.plan_duration);

      // Calculate the exact expiration date
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + durationInMonths);

      // 3. Upgrade the user in the database
      const { error } = await supabase
        .from('profiles')
        .update({
          plan: 'premium',
          plan_duration: durationInMonths,
          plan_expires_at: expirationDate.toISOString(),
          // Reset limits just in case they revert to free later
          ai_explains_used: 0,
          ai_teachings_used: 0,
          quiz_attempts_used: 0,
        })
        .eq('id', userId);

      if (error) throw error;

      // 4. Redirect them to the dashboard with a success message
      return NextResponse.redirect(new URL('/dashboard?upgrade=success', req.url));
    } else {
      throw new Error('Payment verification failed');
    }

  } catch (error) {
    console.error('Verification Error:', error);
    return NextResponse.redirect(new URL('/pricing?error=verification_failed', req.url));
  }
}
