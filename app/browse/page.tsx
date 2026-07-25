"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkBrowseAccess } from '../actions'; // <-- Talks to your secure server

export default function BrowsePage() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // We define your core subjects here since they are columns in your database, not separate tables.
  const subjects = [
    { id: 'pharmacology', name: 'Pharmacology', description: 'General & Autonomic, Systems 1-4' },
    { id: 'pathology', name: 'Pathology', description: 'Anatomical, Chemical, Microbiology, Haematology/Immunology' }
  ];

  const handleSubjectClick = async (subjectId: string, subjectName: string) => {
    setLoadingId(subjectId);
    setError('');

    try {
      // Ask the Gatekeeper if they are allowed in this branch
      const access = await checkBrowseAccess(subjectName);
      
      if (!access.allowed) {
        setError(access.message || "Course locked.");
        setLoadingId(null);
        return;
      }

      // If the Gatekeeper says yes, open the branch!
      router.push(`/browse/${subjectId}`);
    } catch (err) {
      setError("Failed to verify access. Please try again.");
      setLoadingId(null);
    }
  };

  return (
    <main className="p-6 max-w-5xl mx-auto mt-10">
      <h1 className="text-3xl font-bold text-[#0B1220] mb-2">Browse Question Bank</h1>
      <p className="text-slate-600 mb-8">Select a subject to view its clinical divisions.</p>

      {/* The Paywall Error Message Box */}
      {error && (
        <div className="bg-red-50 text-red-800 p-4 rounded-xl mb-6 font-medium text-center border border-red-200 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subjects.map((subject) => (
          <div 
            key={subject.id} 
            onClick={() => handleSubjectClick(subject.id, subject.name)}
            className={`border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow bg-white cursor-pointer group h-full flex flex-col justify-center items-center text-center ${loadingId === subject.id ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <h2 className="text-2xl font-bold text-[#0B1220] group-hover:text-[#E8A23D] transition-colors">
              {loadingId === subject.id ? "Checking Access..." : subject.name}
            </h2>
            <p className="text-slate-500 mt-2 text-sm">{subject.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
