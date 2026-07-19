import { createClient } from '@/lib/supabase/server';
import StudyCard from '@/components/StudyCard';
import Link from 'next/link';

export default async function StudyPage() {
  const supabase = await createClient();
  const { data: questions } = await supabase.from('questions').select('*');

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center p-4 mt-4">
      <div className="w-full mb-6 flex justify-start">
        <Link href="/" className="text-amber-600 font-bold hover:underline">← Back to Dashboard</Link>
      </div>
      <div className="w-full space-y-8">
        {questions && questions.length > 0 ? (
          questions.map((q, i) => (
            <StudyCard key={q.id || i} question={q} index={i + 1} />
          ))
        ) : (
          <p className="text-slate-500 text-center w-full">No questions found in the database.</p>
        )}
      </div>
    </div>
  );
}
