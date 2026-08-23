import { NextResponse } from 'next/server';
import { runBillingMaintenance } from '../../../../lib/maintenance';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runBillingMaintenance()) });
  } catch (error) {
    console.error('Scheduled billing maintenance failed:', error);
    return NextResponse.json({ error: 'Scheduled maintenance failed.' }, { status: 500 });
  }
}
