import { createClient } from './supabase/server';
import { getOrCreateProfile } from './profile';

type FeatureType = 'teaching' | 'explanation' | 'quiz' | 'browse' | 'practical';
type AccessResult = { allowed: boolean; status?: number; message?: string; isAdmin?: boolean; unlimited?: boolean; remainingTextTeaching?: number | null; freePracticalBranch?: string; needsFreePracticalSelection?: boolean };

/** Every costly action is authorized/debited atomically by the medical database. */
export async function checkAccess(feature: FeatureType, requestedCourse?: string, requestedBranch?: string): Promise<AccessResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { allowed: false, status: 401, message: 'Sign in to continue.' };
    const profile = await getOrCreateProfile(supabase, user);
    if (profile.error) return { allowed: false, status: 503, message: 'Unable to verify your subscription.' };
    const { data, error } = await supabase.rpc('authorize_study_feature', {
      p_feature: feature, p_subject: requestedCourse ?? null, p_division: requestedBranch ?? null,
    });
    if (error || !data) return { allowed: false, status: 503, message: 'Unable to verify your allowance. Please try again.' };
    return { allowed: data.allowed === true, status: data.allowed ? 200 : 403, message: data.message, isAdmin: data.admin === true, unlimited: data.admin === true, remainingTextTeaching: data.remaining };
  } catch {
    return { allowed: false, status: 503, message: 'Unable to verify your subscription.' };
  }
}
