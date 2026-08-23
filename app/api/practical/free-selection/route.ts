import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { ANATOMICAL_PATHOLOGY_SYSTEMS, getAnatomicalPathologySystem } from '../../../../lib/practical-catalogue';
import { isPaidPlan } from '../../../../lib/plans';
import { getOrCreateProfile } from '../../../../lib/profile';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });

  const { data: profile, error } = await getOrCreateProfile(supabase, user);
  if (error || !profile) return NextResponse.json({ error: 'Your account profile could not be loaded. Please refresh and try again.' }, { status: 500 });

  const paid = isPaidPlan(profile.plan) && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date());
  return NextResponse.json({
    systems: ANATOMICAL_PATHOLOGY_SYSTEMS,
    selected: profile.selected_free_practical_branch ?? null,
    unlimited: profile.role === 'admin' || paid,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const selected = getAnatomicalPathologySystem(typeof body?.system === 'string' ? body.system : undefined);
  if (!selected) return NextResponse.json({ error: 'Choose a listed Anatomical Pathology organ/system.' }, { status: 400 });

  const { data: profile, error: profileError } = await getOrCreateProfile(supabase, user);
  if (profileError || !profile) return NextResponse.json({ error: 'Your account profile could not be loaded. Please refresh and try again.' }, { status: 500 });

  const paid = isPaidPlan(profile.plan) && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date());
  if (profile.role === 'admin' || paid) return NextResponse.json({ selected: profile.selected_free_practical_branch ?? null, unlimited: true });
  if (profile.selected_free_practical_branch) {
    return NextResponse.json({ error: `Your free practical access is already set to ${profile.selected_free_practical_branch}.`, selected: profile.selected_free_practical_branch }, { status: 409 });
  }

  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update({ selected_free_practical_branch: selected })
    .eq('id', user.id)
    .is('selected_free_practical_branch', null)
    .select('selected_free_practical_branch')
    .maybeSingle();
  if (updateError) return NextResponse.json({ error: 'Unable to save your free practical choice.' }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Your free practical choice was already set. Refresh and continue.' }, { status: 409 });
  return NextResponse.json({ selected: updated.selected_free_practical_branch, unlimited: false });
}
