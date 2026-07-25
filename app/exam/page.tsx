"use client";
import { useState } from 'react';
import Link from 'next/link';

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
  const [subject, setSubject] = useState('Pharmacology');
  const [division, setDivision] = useState(curriculumMap['Pharmacology'][0]);
  const [questionCount, setQuestionCount] = useState(20);

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

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full border border-slate-100">
        <div className="flex justify-center mb-6 text-4xl">⏱️</div>
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Medical Assessment</h1>
        <p className="text-slate-500 text-sm text-center mb-8">Configure your mock exam parameters.</p>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Subject</label>
            <select 
              value={subject} 
              onChange={handleSubjectChange}
              className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-[#E8A23D] outline-none transition-colors"
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
              className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-[#E8A23D] outline-none transition-colors"
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
              className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-[#E8A23D] outline-none transition-colors"
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

          <Link href={examUrl} className="w-full block mt-4">
            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-md">
              Start Mock Exam →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
