'use server';

import { createClient } from '../lib/supabase/server';

export async function saveExamResult(testTitle: string, score: number, totalQuestions: number, percentage: number) {
  const supabase = await createClient();
  
  // 1. Get the securely logged-in user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error("Auth error or no user found", authError);
    return { success: false, error: "Not authenticated" };
  }

  // 2. Insert the score into our new table
  const { error } = await supabase
    .from('exam_results')
    .insert([
      {
        user_id: user.id,
        test_title: testTitle,
        score: score,
        total_questions: totalQuestions,
        percentage: percentage
      }
    ]);

  if (error) {
    console.error("Error saving score:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
