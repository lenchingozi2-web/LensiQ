'use server';

import { createClient } from '../lib/supabase/server';
import { checkAccess } from '../lib/gatekeeper'; // <-- Moved safely to the top!

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

export async function checkQuizAccess() {
  // This calls your secure server-side Gatekeeper from the client safely
  const access = await checkAccess('quiz');
  return access;
}

export async function checkBrowseAccess(courseName: string) {
  // This checks if the user is allowed to browse this specific branch
  const access = await checkAccess('browse', courseName);
  return access;
}
