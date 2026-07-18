import { createClient } from '../../../lib/supabase/server';
import Link from 'next/link';

export default async function SubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const supabase = await createClient();
  
  // Next.js 16 requires us to await the URL parameters first
  const resolvedParams = await params;
  const subjectId = resolvedParams.subject; 

  const title = subjectId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const { data, error } = await supabase
    .from('questions')
    .select('division')
    .ilike('subject', title);

  let divisions: string[] = [];
  if (data) {
    const allDivisions = data.map(q => q.division).filter(Boolean);
    divisions = Array.from(new Set(allDivisions)).sort();
  }

  return (
    <main className="p-6 max-w-5xl mx-auto mt-10">
      <div className="mb-8">
        <Link href="/browse" className="text-[#E8A23D] hover:underline text-sm font-semibold mb-4 inline-block">
          &larr; Back to Subjects
        </Link>
        <h1 className="text-3xl font-bold text-[#0B1220] mt-2">{title} Divisions</h1>
        <p className="text-slate-600 mt-1">Select a division to view its specific topics.</p>
      </div>

      {error ? (
        <div className="bg-red-100 p-4 rounded text-red-700">
          <strong>Database Error:</strong> {error.message}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {divisions.length > 0 ? (
             divisions.map((division, i) => (
               <Link key={i} href={`/browse/${subjectId}/${encodeURIComponent(division)}`}>
                 <div className="border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white cursor-pointer group h-full flex flex-col justify-center items-start">
                   <h2 className="text-xl font-bold text-[#0B1220] group-hover:text-[#E8A23D] transition-colors">
                     {division}
                   </h2>
                 </div>
               </Link>
             ))
          ) : (
             <div className="col-span-2 bg-slate-50 p-8 text-center border rounded-xl text-slate-500">
               <p className="font-semibold text-lg mb-2">No divisions found.</p>
             </div>
          )}
        </div>
      )}
    </main>
  );
}
