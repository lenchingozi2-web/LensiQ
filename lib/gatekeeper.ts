import { createClient } from './supabase/server';
import { isPaidPlan } from './plans';
import { FREE_PRACTICAL_BRANCH, normalizePracticalBranch } from './practical-catalogue';

type FeatureType = 'teaching' | 'explanation' | 'quiz' | 'browse' | 'practical';

type AccessResult = {
  allowed: boolean;
  status?: number;
  message?: string;
  isAdmin?: boolean;
  unlimited?: boolean;
  freePracticalBranch?: string;
};

export async function checkAccess(feature: FeatureType, requestedCourse?: string, requestedPracticalBranch?: string): Promise<AccessResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { allowed: false, status: 401, message: 'Not logged in.' };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return { allowed: false, status: 500, message: 'Database error.' };

    // Administrators are never subject to plan expiry, feature limits, or premium gates.
    if (profile.role === 'admin') return { allowed: true, isAdmin: true, unlimited: true };

    const now = new Date();
    const expiresAt = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null;
    const paidPlanExpired = isPaidPlan(profile.plan) && Boolean(expiresAt && now > expiresAt);

    if (paidPlanExpired) {
      await supabase.from('profiles').update({ plan: 'free', plan_duration: 0 }).eq('id', user.id);
      profile.plan = 'free';
      profile.plan_duration = 0;
    }

    if (profile.plan === 'free' && (!expiresAt || now > expiresAt)) {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      await supabase.from('profiles').update({ ai_teachings_used: 0, ai_explanations_used: 0, quiz_attempts_used: 0, plan_expires_at: nextMonth.toISOString() }).eq('id', user.id);
      profile.ai_teachings_used = 0;
      profile.ai_explanations_used = 0;
      profile.quiz_attempts_used = 0;
    }

    if (isPaidPlan(profile.plan)) return { allowed: true, unlimited: true };

    if (feature === 'practical') {
      const requestedBranch = normalizePracticalBranch(requestedPracticalBranch);
      if (requestedBranch === normalizePracticalBranch(FREE_PRACTICAL_BRANCH)) {
        return { allowed: true, freePracticalBranch: FREE_PRACTICAL_BRANCH };
      }
      return { allowed: false, status: 403, message: `Free access includes the ${FREE_PRACTICAL_BRANCH} practical branch. Upgrade to unlock every practical system.` };
    }

    if (feature === 'browse') {
      if (requestedCourse) {
        if (profile.selected_free_course && requestedCourse !== profile.selected_free_course) return { allowed: false, status: 403, message: `Course locked: your free plan includes ${profile.selected_free_course}.` };
        if (!profile.selected_free_course) await supabase.from('profiles').update({ selected_free_course: requestedCourse }).eq('id', user.id);
      }
      return { allowed: true };
    }

    const limits = {
      teaching: { used: profile.ai_teachings_used || 0, max: 6, column: 'ai_teachings_used' },
      explanation: { used: profile.ai_explanations_used || 0, max: 30, column: 'ai_explanations_used' },
      quiz: { used: profile.quiz_attempts_used || 0, max: 3, column: 'quiz_attempts_used' },
    } as const;

    const currentFeature = limits[feature as keyof typeof limits];
    if (!currentFeature) return { allowed: false, status: 400, message: 'Unsupported feature.' };
    if (currentFeature.used >= currentFeature.max) return { allowed: false, status: 403, message: 'Limit reached.' };

    await supabase.from('profiles').update({ [currentFeature.column]: currentFeature.used + 1 }).eq('id', user.id);
    return { allowed: true };
  } catch (error) {
    console.error('Access check failed:', error);
    return { allowed: false, status: 500, message: 'Server error.' };
  }
}
