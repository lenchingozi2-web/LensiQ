import { createClient } from './supabase/server';

type FeatureType = 'teaching' | 'explanation' | 'quiz' | 'browse';

export async function checkAccess(feature: FeatureType, requestedCourse?: string) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { allowed: false, status: 401, message: "Not logged in." };
    }

    // BULLETPROOF QUERY: Using '*' prevents the database from crashing if a column is missing
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*') 
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { allowed: false, status: 500, message: "Database error." };
    }

    // ==========================================
    // RULE 1: THE ADMIN BYPASS
    // ==========================================
    if (profile.role === 'admin') {
      return { allowed: true };
    }

    // ==========================================
    // AUTOMATED 30-DAY ROLLING RESET (For Free Users)
    // ==========================================
    const now = new Date();
    const expiresAt = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null;

    if (profile.plan === 'free' && (!expiresAt || now > expiresAt)) {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30); 

      await supabase
        .from('profiles')
        .update({
          ai_teachings_used: 0,
          ai_explanations_used: 0,
          quiz_attempts_used: 0,
          plan_expires_at: nextMonth.toISOString()
        })
        .eq('id', user.id);

      profile.ai_teachings_used = 0;
      profile.ai_explanations_used = 0;
      profile.quiz_attempts_used = 0;
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
        return { allowed: false, status: 403, message: "Course locked." };
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
      return { allowed: false, status: 403, message: "Limit reached." };
    }

    // ==========================================
    // RULE 5: CHARGE THE USAGE
    // ==========================================
    await supabase
      .from('profiles')
      .update({ [currentFeature.column]: currentFeature.used + 1 })
      .eq('id', user.id);

    return { allowed: true };

  } catch (error: any) {
    return { allowed: false, status: 500, message: "Server error." };
  }
}
