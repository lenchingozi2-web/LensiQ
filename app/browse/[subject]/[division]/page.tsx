import Link from 'next/link';

export default async function DivisionPage({ params }: { params: Promise<{ subject: string, division: string }> }) {
  // Await the URL parameters
  const resolvedParams = await params;
  const subjectId = resolvedParams.subject;
  const divisionName = decodeURIComponent(resolvedParams.division);
  
  const title = subjectId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <main className="p-6 max-w-5xl mx-auto mt-10">
      <div className="mb-8">
        <Link href={`/browse/${subjectId}`} className="text-[#E8A23D] hover:underline text-sm font-semibold mb-4 inline-block">
          &larr; Back to {title} Divisions
        </Link>
        <h1 className="text-3xl font-bold text-[#0B1220] mt-2">{divisionName}</h1>
        <p className="text-slate-600 mt-1">Select the question format you want to study.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href={`/browse/${subjectId}/${encodeURIComponent(divisionName)}/mcq`}>
          <div className="border border-slate-200 p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white cursor-pointer group h-full flex flex-col justify-center items-center text-center">
            <h2 className="text-2xl font-bold text-[#0B1220] group-hover:text-[#E8A23D] transition-colors mb-2">
              Multiple Choice (MCQ)
            </h2>
            <p className="text-slate-500 text-sm">Practice with objective questions, options, and explanations.</p>
          </div>
        </Link>

        <Link href={`/browse/${subjectId}/${encodeURIComponent(divisionName)}/theory`}>
          <div className="border border-slate-200 p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white cursor-pointer group h-full flex flex-col justify-center items-center text-center">
            <h2 className="text-2xl font-bold text-[#0B1220] group-hover:text-[#E8A23D] transition-colors mb-2">
              Theory Questions
            </h2>
            <p className="text-slate-500 text-sm">Review long-form questions and detailed model answers.</p>
          </div>
        </Link>
      </div>
    </main>
  );
}
