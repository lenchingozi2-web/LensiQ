"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkQuizAccess } from '../actions'; // <-- Talks to your secure server

// Perfectly synchronized with your Browse Mode routing strings
const curriculumMap: Record<string, string[]> = {
  "Pharmacology": [
    "Cardiovascular, Renal, Gastrointestinal, Respiratory and Haemopoietic Pharmacology",
    "Central Nervous System Pharmacology and Toxicology",
    "Chemotherapy",
    "Endocrine Pharmacology and Immunopharmacology",
    "General and Autonomic Nervous System Pharmacology"
  ],
  "Pathology": [
    "Anatomical Pathology",
    "Chemical Pathology",
    "Immunology/Haematology",
    "Microbiology"
  ]
};

export default function MockExamSetup() {
  const router = useRouter();
  const [subject, setSubject] = useState('Pharmacology');
  const [division, setDivision] = useState(curriculumMap['Pharmacology'][0]);
  const [questionCount, setQuestionCount] = useState(20);
  
  // New states for the Gatekeeper
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSubject = e.target.value;
    setSubject(newSubject);
    setDivision(curriculumMap[newSubject][0]); 
  };

  const totalSeconds = questionCount * 50;
  const timeInMinutes = Math.ceil(totalSeconds / 60);

  const formattedSubject = subject.toLowerCase().replace(/\s+/g, '-');
  const formattedDivision = encodeURIComponent(division);
  const examUrl = `/browse/${formattedSubject}/${formattedDivision}/quiz?count=${questionCount}`;

  // The new Gatekeeper check
  const handleStartExam = async () => {
    setLoading(true);
    setError('');

    try {
      const access = await checkQuizAccess();
      if (!access.allowed) {
        setError(access.message || "Limit reached.");
        setLoading(false);
        return;
      }
      
      // If the Gatekeeper says yes, launch the quiz!
      router.push(examUrl);
    } catch {
      setError("Failed to verify access. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full border border-slate-100">
        <div className="flex justify-center mb-6 text-4xl">⏱️</div>
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Medical Assessment</h1>
        <p className="text-slate-500 text-sm text-center mb-8">Configure your mock exam parameters.</p>
        
        {/* The Paywall Error Message Box */}
        {error && (
          <div className="bg-red-50 text-red-800 p-4 rounded-xl mb-6 font-medium text-center border border-red-200 text-sm">
            ⚠️ {error}
          </div>
        )}
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
            <select 
              value={subject} 
              onChange={handleSubjectChange}
              disabled={loading}
              className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-[#E8A23D] outline-none transition-colors disabled:opacity-50"
            >
              {Object.keys(curriculumMap).map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Division</label>
            <select 
              value={division} 
              onChange={(e) => setDivision(e.target.value)}
              disabled={loading}
              className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-[#E8A23D] outline-none transition-colors disabled:opacity-50"
            >
              {curriculumMap[subject].map((div) => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Number of Questions</label>
            <select 
              value={questionCount} 
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              disabled={loading}
              className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-[#E8A23D] outline-none transition-colors disabled:opacity-50"
            >
              <option value={10}>10 Questions</option>
              <option value={20}>20 Questions</option>
              <option value={50}>50 Questions</option>
              <option value={100}>100 Questions</option>
            </select>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              ℹ️ {timeInMinutes} mins total (50 sec allotted per question)
            </p>
          </div>

          <button 
            onClick={handleStartExam}
            disabled={loading}
            className="w-full block mt-4 bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? "Checking Access..." : "Start Mock Exam →"}
          </button>
        </div>
      </div>
    </div>
  );
}
