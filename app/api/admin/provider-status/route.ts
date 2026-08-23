import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { getProviderStatuses } from '../../../../lib/provider-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const providers = await getProviderStatuses();
  return NextResponse.json({ checkedAt: new Date().toISOString(), providers });
}
