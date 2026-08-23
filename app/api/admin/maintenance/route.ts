import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { runBillingMaintenance } from '../../../../lib/maintenance';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await runBillingMaintenance()) });
  } catch (error) {
    console.error('Billing maintenance failed:', error);
    return NextResponse.json({ error: 'Maintenance could not be completed.' }, { status: 500 });
  }
}
