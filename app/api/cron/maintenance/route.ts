import { NextResponse } from 'next/server';
import { runBillingMaintenance } from '../../../../lib/maintenance';
import { createAdminClient } from '@/lib/supabase/admin';
import { sweepAllExpiredSyllabi } from '@/lib/rag/ephemeral-cleanup';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    const billing = await runBillingMaintenance();
    const admin = createAdminClient();
    let classMaterialSweep = { purged: 0, failed: 0 };
    if (admin) classMaterialSweep = await sweepAllExpiredSyllabi(admin);
    return NextResponse.json({ ok: true, ...billing, classMaterialSweep });
  } catch (error) {
    console.error('Scheduled billing maintenance failed:', error);
    return NextResponse.json({ error: 'Scheduled maintenance failed.' }, { status: 500 });
  }
}
