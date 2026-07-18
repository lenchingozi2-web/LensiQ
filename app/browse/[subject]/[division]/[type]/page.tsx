import { createClient } from '../../../../../lib/supabase/server';
import StudyCard from '../../../../../components/StudyCard';
import Link from 'next/link';

export default async function BrowseModePage({ params }: { params: Promise<{ subject: string, division: string, type: string }> }) {
  const supabase = await createClient();
  const resolvedParams = await params;
  
  const subjectId = resolvedParams.subject;
  const divisionName = decodeURIComponent(resolvedParams.division);
  const questionType = resolvedParams.type;

  // Format subject title for the query
  const subjectTitle = subjectId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Fetch all questions for this division and type (mcq or theory)
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .ilike('subject', subjectTitle)
    .eq('division', divisionName)
    .eq('type', questionType);

  // Fallback UI if no questions are found
  if (error || !questions || questions.length === 0) {
    return (
      <main className="p-6 max-w-3xl mx-auto mt-10 text-center">
         <h1 className="text-2xl font-bold mb-4">No Questions Found</h1>
         <p className="text-slate-600 mb-6">We couldn't find any {questionType.toUpperCase()} questions for {divisionName}.</p>
         <Link href={`/browse/${subjectId}/${encodeURIComponent(divisionName)}`} className="text-[#E8A23D] font-bold hover:underline">
           &larr; Go Back
         </Link>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8 bg-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-8">
          <Link href={`/browse/${subjectId}/${encodeURIComponent(divisionName)}`} className="text-sm font-bold text-[#E8A23D] hover:underline mb-2 inline-block">
            &larr; Back to Formats
          </Link>
          <h1 className="text-3xl font-bold text-[#0B1220] leading-tight mb-2">{divisionName}</h1>
          <p className="text-slate-500 font-medium">Study Mode • {questions.length} Questions</p>
        </div>

        {/* Map out the AI Study Cards */}
        <div className="space-y-8">
          {questions.map((q, index) => (
            <StudyCard key={q.id} question={q} index={index} />
          ))}
        </div>

      </div>
    </main>
  );
}
