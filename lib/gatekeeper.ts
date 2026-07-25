import { createClient } from './supabase/server';

type FeatureType = 'teaching' | 'explanation' | 'quiz' | 'browse';

export async function checkAccess(feature: FeatureType, requestedCourse?: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { allowed: false, error: "Unauthorized", status: 401 };

  // Fetch the profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('role, plan, ai_teachings_used, ai_explanations_used, quiz_attempts_used, selected_free_course, plan_expires_at')
    .eq('id', user.id)
    .single();

  if (!profile) return { allowed: false, error: "Profile not found", status: 404 };

  // ==========================================
  // AUTOMATED 30-DAY ROLLING RESET (For Free Users)
  // ==========================================
  const now = new Date();
  const expiresAt = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null;

  // If they have no expiration date, or the date is in the past, reset their limits!
  if (profile.plan === 'free' && (!expiresAt || now > expiresAt)) {
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30); // Add exactly 30 days

    // Update database immediately
    await supabase
      .from('profiles')
      .update({
        ai_teachings_used: 0,
        ai_explanations_used: 0,
        quiz_attempts_used: 0,
        plan_expires_at: nextMonth.toISOString()
      })
      .eq('id', user.id);

    // Update our local profile object so the rest of the checks use the fresh limits
    profile.ai_teachings_used = 0;
    profile.ai_explanations_used = 0;
    profile.quiz_attempts_used = 0;
  }

  // ==========================================
  // RULE 1: THE ADMIN BYPASS
  // ==========================================
  if (profile.role === 'admin') {
    return { allowed: true };
  }

  // ==========================================
  // RULE 2: THE ELITE SCHOLAR BYPASS
  // ==========================================
  if (profile.plan && profile.plan !== 'free') {
    return { allowed: true };
  }

  // ==========================================
  // RULE 3: BROWSE MODE (One Branch Limit)
  // ==========================================
  if (feature === 'browse') {
    if (requestedCourse && profile.selected_free_course && requestedCourse !== profile.selected_free_course) {
      return { 
        allowed: false, 
        error: "course_locked", 
        message: `Your Basic Trainee plan only includes access to ${profile.selected_free_course}. Upgrade to Elite Scholar to unlock ${requestedCourse}.`,
        status: 403 
      };
    }
    return { allowed: true }; 
  }

  // ==========================================
  // RULE 4: NUMERICAL LIMITS (Teach, MCQ, Mock)
  // ==========================================
  const limits = {
    teaching: { used: profile.ai_teachings_used || 0, max: 6, column: 'ai_teachings_used' },
    explanation: { used: profile.ai_explanations_used || 0, max: 30, column: 'ai_explanations_used' },
    quiz: { used: profile.quiz_attempts_used || 0, max: 3, column: 'quiz_attempts_used' }
  };

  const currentFeature = limits[feature as keyof typeof limits];

  if (currentFeature.used >= currentFeature.max) {
    return { 
      allowed: false, 
      error: "limit_reached", 
      message: `You have reached your free limit for this feature. Upgrade to Premium for unlimited access.`,
      status: 403 
    };
  }

  // ==========================================
  // RULE 5: CHARGE THE USAGE
  // ==========================================
  await supabase
    .from('profiles')
    .update({ [currentFeature.column]: currentFeature.used + 1 })
    .eq('id', user.id);

  return { allowed: true };
}
