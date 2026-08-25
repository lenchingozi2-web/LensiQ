import { createClient } from '../../../../../lib/supabase/server';
import CbtEngine from '../../../../../components/CbtEngine';
import Link from 'next/link';

export default async function QuizSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ subject: string; division: string }>;
  searchParams: Promise<{ count?: string | string[] }>;
}) {
  const supabase = await createClient();
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  
  const subjectId = resolvedParams.subject;
  const rawCount = Array.isArray(resolvedSearchParams.count) ? resolvedSearchParams.count[0] : resolvedSearchParams.count;
  const requestedCount = rawCount ? Number.parseInt(rawCount, 10) : NaN;
  const initialQuestionCount = [10, 20, 50, 100].includes(requestedCount) ? requestedCount : undefined;
  const divisionName = decodeURIComponent(resolvedParams.division);

  // Format subject title for the query
  const subjectTitle = subjectId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // FIXED: Using % wildcards so Supabase ignores accidental spaces (e.g., "Microbiology ")
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .ilike('subject', `%${subjectTitle}%`)
    .ilike('division', `%${divisionName}%`)
    .ilike('type', '%mcq%');

  // If there's an error or no questions, show the fallback UI WITH DEBUG INFO
  if (error || !questions || questions.length === 0) {
    return (
      <main className="p-6 max-w-3xl mx-auto mt-10 text-center flex flex-col items-center">
         <h1 className="text-2xl font-bold mb-4 text-slate-900">Cannot Start Quiz</h1>
         <p className="text-slate-600 mb-4">No multiple-choice questions were found.</p>
         
         {/* Diagnostic Box to see exactly what Supabase is looking for */}
         <div className="bg-slate-100 p-4 rounded-xl border border-slate-300 text-left mb-8 w-full max-w-md shadow-inner">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">Database Query Sent:</p>
            <code className="text-sm text-slate-800 block mb-1">Subject: &quot;{subjectTitle}&quot;</code>
            <code className="text-sm text-slate-800 block mb-1">Division: &quot;{divisionName}&quot;</code>
            <code className="text-sm text-slate-800 block mb-1">Type: &quot;mcq&quot;</code>
            {error && <code className="text-sm text-red-600 block mt-3 font-bold">Error: {error.message}</code>}
         </div>

         {/* Fixed back button to point directly back to your setup screen */}
         <Link href={`/exam`} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">
           &larr; Back to Exam Setup
         </Link>
      </main>
    );
  }

  // Pass the data to your interactive client component
  return (
    <main className="p-2 sm:p-4 bg-slate-50 min-h-screen">
      <CbtEngine 
        questions={questions}
        testTitle={`${divisionName} Mock Exam`}
        initialQuestionCount={initialQuestionCount}
      />
    </main>
  );
}
