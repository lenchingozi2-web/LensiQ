import { createClient } from './supabase/server';
import { isPaidPlan } from './plans';
import { isFreeAnatomicalPathologySystem } from './practical-catalogue';
import { getOrCreateProfile } from './profile';

type FeatureType = 'teaching' | 'explanation' | 'quiz' | 'browse' | 'practical';

type AccessResult = {
  allowed: boolean;
  status?: number;
  message?: string;
  isAdmin?: boolean;
  unlimited?: boolean;
  remainingTextTeaching?: number | null;
  freePracticalBranch?: string;
  needsFreePracticalSelection?: boolean;
};

export async function checkAccess(feature: FeatureType, requestedCourse?: string, requestedPracticalBranch?: string): Promise<AccessResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { allowed: false, status: 401, message: 'Not logged in.' };

    const { data: profile, error: profileError } = await getOrCreateProfile(supabase, user);

    if (profileError || !profile) {
      console.error('Access check profile lookup failed:', profileError?.message || 'profile unavailable');
      return { allowed: false, status: 500, message: 'Your account profile could not be loaded. Please refresh and try again.' };
    }

    // Administrators are never subject to plan expiry, feature limits, or premium gates.
    if (profile.role === 'admin') return { allowed: true, isAdmin: true, unlimited: true };

    const now = new Date();
    const expiresAt = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null;
    const paidPlanExpired = isPaidPlan(profile.plan) && Boolean(expiresAt && now > expiresAt);

    if (paidPlanExpired) {
      await supabase.from('profiles').update({ plan: 'free', plan_duration: 0, voice_minutes_balance: 0, text_teaching_balance: 0, wallet_reset_at: null }).eq('id', user.id);
      profile.plan = 'free';
      profile.plan_duration = 0;
      profile.voice_minutes_balance = 0;
      profile.text_teaching_balance = 0;
      profile.wallet_reset_at = null;
    }

    if (profile.plan === 'free' && (!expiresAt || now > expiresAt)) {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      await supabase.from('profiles').update({ ai_teachings_used: 0, ai_explanations_used: 0, quiz_attempts_used: 0, plan_expires_at: nextMonth.toISOString() }).eq('id', user.id);
      profile.ai_teachings_used = 0;
      profile.ai_explanations_used = 0;
      profile.quiz_attempts_used = 0;
    }

    if (isPaidPlan(profile.plan)) {
      if (feature === 'teaching') {
        const { data: debitRows, error: debitError } = await supabase.rpc('consume_text_teaching_credit', {
          p_idempotency_key: crypto.randomUUID(),
        });
        const debit = Array.isArray(debitRows) ? debitRows[0] : debitRows;
        if (debitError || !debit) return { allowed: false, status: 500, message: 'Unable to confirm your Teaching credit right now. Please try again.' };
        if (!debit.allowed) {
          const message = debit.reason === 'text_teaching_balance_empty'
            ? 'Your monthly text-teaching allowance is empty. It resets at your next billing date.'
            : 'Your Premium teaching allowance is not available. Please check your plan status.';
          return { allowed: false, status: 403, message, remainingTextTeaching: debit.remaining_credits ?? 0 };
        }
        return { allowed: true, unlimited: false, remainingTextTeaching: debit.remaining_credits ?? null };
      }
      return { allowed: true, unlimited: true };
    }

    if (feature === 'practical') {
      const selectedFreeBranch = typeof profile.selected_free_practical_branch === 'string' ? profile.selected_free_practical_branch.trim() : '';
      if (!selectedFreeBranch) {
        return {
          allowed: false,
          status: 403,
          needsFreePracticalSelection: true,
          message: 'Choose one practical organ/system across the platform for your free access. Other practical systems require a subscription.',
        };
      }
      if (requestedPracticalBranch && isFreeAnatomicalPathologySystem(requestedPracticalBranch, selectedFreeBranch)) {
        return { allowed: true, freePracticalBranch: selectedFreeBranch };
      }
      return {
        allowed: false,
        status: 403,
        freePracticalBranch: selectedFreeBranch,
        message: `Your single free practical access is set to ${selectedFreeBranch}. Other practical systems across the platform require a subscription.`,
      };
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
