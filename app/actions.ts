'use server';

import { createClient } from '../lib/supabase/server';
import { checkAccess } from '../lib/gatekeeper';

// 1. The Exam Saver
export async function saveExamResult(testTitle: string, score: number, totalQuestions: number, percentage: number) {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error("Auth error or no user found", authError);
    return { success: false, error: "Not authenticated" };
  }

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

// 2. The Gatekeeper Locks
export async function checkQuizAccess() {
  const access = await checkAccess('quiz');
  return access;
}

export async function checkBrowseAccess(courseName: string) {
  const access = await checkAccess('browse', courseName);
  return access;
}
