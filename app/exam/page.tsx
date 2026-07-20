"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MockExamSetup() {
  const router = useRouter();
  const [subject, setSubject] = useState('Pharmacology');
  const [division, setDivision] = useState('Autonomic');
  const [questionCount, setQuestionCount] = useState(20);

  // Calculates the strict 50 seconds per question rule into minutes
  const totalSeconds = questionCount * 50;
  const timeInMinutes = Math.ceil(totalSeconds / 60);

  const handleStartExam = () => {
    // Route to the actual exam session with all parameters attached
    router.push(`/exam/session?subject=${subject}&division=${division}&count=${questionCount}`);
  };

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
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-[#E8A23D] outline-none transition-colors"
            >
              <option value="Pharmacology">Pharmacology</option>
              <option value="Pathology">Pathology</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Division</label>
            <select 
              value={division} 
              onChange={(e) => setDivision(e.target.value)}
              className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-[#E8A23D] outline-none transition-colors"
            >
              <option value="Autonomic">Autonomic</option>
              <option value="Chemical Pathology">Chemical Pathology</option>
              <option value="Anatomical Pathology">Anatomical Pathology</option>
              <option value="Microbiology">Microbiology</option>
              <option value="Haematology/Immunology">Haematology/Immunology</option>
              <option value="General">General</option>
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

          <button 
            onClick={handleStartExam}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-md mt-4"
          >
            Start Mock Exam →
          </button>
        </div>
      </div>
    </div>
  );
}
