import { createClient } from '../../../../../lib/supabase/server';
import CbtEngine from '../../../../../components/CbtEngine';
import Link from 'next/link';

export default async function QuizSetupPage({ params }: { params: Promise<{ subject: string, division: string }> }) {
  const supabase = await createClient();
  const resolvedParams = await params;
  
  const subjectId = resolvedParams.subject;
  const divisionName = decodeURIComponent(resolvedParams.division);

  // Format subject title for the query
  const subjectTitle = subjectId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Fetch ALL MCQs for this division
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .ilike('subject', subjectTitle)
    .eq('division', divisionName)
    .eq('type', 'mcq');

  // If there's an error or no questions, show a fallback UI
  if (error || !questions || questions.length === 0) {
    return (
      <main className="p-6 max-w-3xl mx-auto mt-10 text-center">
         <h1 className="text-2xl font-bold mb-4">Cannot Start Quiz</h1>
         <p className="text-slate-600 mb-6">No multiple-choice questions were found for {divisionName}.</p>
         <Link href={`/browse/${subjectId}/${encodeURIComponent(divisionName)}`} className="text-[#E8A23D] font-bold hover:underline">
           &larr; Go Back
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
      />
    </main>
  );
}
