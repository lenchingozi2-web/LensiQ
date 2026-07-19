import { createClient } from '@/lib/supabase/server';
import CbtEngine from '@/components/CbtEngine';
import Link from 'next/link';

export default async function ExamPage() {
  const supabase = await createClient();
  const { data: questions } = await supabase.from('questions').select('*');

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center p-4 mt-4">
      <div className="w-full mb-4 flex justify-start">
        <Link href="/" className="text-amber-600 font-bold hover:underline">← Back to Dashboard</Link>
      </div>
      <CbtEngine questions={questions || []} testTitle="Medical Assessment" />
    </div>
  );
}
