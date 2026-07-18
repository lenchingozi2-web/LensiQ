import Link from 'next/link';

export default function BrowsePage() {
  // We define your core subjects here since they are columns in your database, not separate tables.
  const subjects = [
    { id: 'pharmacology', name: 'Pharmacology', description: 'General & Autonomic, Systems 1-4' },
    { id: 'pathology', name: 'Pathology', description: 'Anatomical, Chemical, Microbiology, Haematology/Immunology' }
  ];

  return (
    <main className="p-6 max-w-5xl mx-auto mt-10">
      <h1 className="text-3xl font-bold text-[#0B1220] mb-2">Browse Question Bank</h1>
      <p className="text-slate-600 mb-8">Select a subject to view its clinical divisions.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subjects.map((subject) => (
          <Link key={subject.id} href={`/browse/${subject.id}`}>
            <div className="border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white cursor-pointer group h-full flex flex-col justify-center items-center text-center">
              <h2 className="text-2xl font-bold text-[#0B1220] group-hover:text-[#E8A23D] transition-colors">
                {subject.name}
              </h2>
              <p className="text-slate-500 mt-2 text-sm">{subject.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
