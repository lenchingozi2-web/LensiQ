'use client'; 

import { useState, useEffect } from 'react';
import { saveExamResult } from '../app/actions';

type Question = {
  id: string;
  question_text?: string;
  stem?: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e?: string;
  correct_answer?: string;
  model_answer?: string;
};

export default function CbtEngine({ questions, testTitle }: { questions: Question[], testTitle: string }) {
  // Setup State
  const [isStarted, setIsStarted] = useState(false);
  const [selectedCount, setSelectedCount] = useState(Math.min(20, questions.length)); 
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);

  // Engine State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0); 
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Review Mode State
  const [isReviewMode, setIsReviewMode] = useState(false);

  const handleStartExam = () => {
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, selectedCount);
    
    setActiveQuestions(selected);
    setTimeLeft(selected.length * 50); 
    setIsStarted(true);
  };

  const currentQuestion = activeQuestions[currentIndex];

  // Upgraded Final Submit Logic with Database Saving
  const handleFinalSubmit = async (forceSubmit = false) => {
    if (forceSubmit || window.confirm('Are you sure you want to submit this test?')) {
      
      // Calculate Score Immediately
      const finalScore = activeQuestions.reduce((acc, q, idx) => {
        const correctLetter = q.correct_answer?.toLowerCase().trim() || '';
        const isCorrect = answers[idx] === correctLetter;
        return acc + (isCorrect ? 1 : 0);
      }, 0);
      const finalPercentage = Math.round((finalScore / activeQuestions.length) * 100);

      // Fire the score off to the Supabase database in the background
      saveExamResult(testTitle, finalScore, activeQuestions.length, finalPercentage)
        .catch(err => console.error("Failed to save:", err));

      // Show the Results UI
      setIsSubmitted(true);
      setCurrentIndex(0); 
    }
  };

  // The Timer Engine
  useEffect(() => {
    if (!isStarted || isSubmitted) return;

    if (timeLeft <= 0) {
      handleFinalSubmit(true); // Forces auto-submit when time is up
      return;
    }

    const timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, isSubmitted, isStarted]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (letter: string) => {
    setAnswers((prev) => ({ ...prev, [currentIndex]: letter }));
  };

  // -------------------------------------------------------------
  // UI 1: PRE-EXAM SETUP SCREEN
  // -------------------------------------------------------------
  if (!isStarted) {
    return (
      <div className="p-8 text-center mt-10 max-w-xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="text-5xl mb-4">⏱</div>
        <h2 className="text-3xl font-bold text-[#0B1220] mb-2">{testTitle}</h2>
        <p className="text-slate-500 mb-8 font-medium">Total Bank: {questions.length} Questions</p>

        <div className="mb-8 text-left bg-slate-50 p-6 rounded-xl border border-slate-100">
          <label className="block text-slate-800 font-bold mb-3">How many questions do you want to attempt?</label>
          <select 
            value={selectedCount}
            onChange={(e) => setSelectedCount(Number(e.target.value))}
            className="w-full p-4 border border-slate-300 rounded-lg bg-white text-slate-800 font-medium focus:ring-2 focus:ring-[#E8A23D] outline-none transition-shadow"
          >
            {[10, 20, 50, 100].filter(n => n <= questions.length).map(num => (
              <option key={num} value={num}>
                {num} Questions ({Math.ceil((num * 50) / 60)} mins)
              </option>
            ))}
            <option value={questions.length}>All Questions ({questions.length})</option>
          </select>
          <p className="text-sm text-slate-400 mt-3 flex items-center gap-2">
            <span>ℹ️</span> 50 seconds allotted per question.
          </p>
        </div>

        <button 
          onClick={handleStartExam} 
          className="w-full bg-[#0B1220] hover:bg-slate-800 text-white font-bold py-4 px-6 rounded-xl transition-colors shadow-md"
        >
          Start Mock Exam &rarr;
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // UI 2: POST-EXAM SUBMISSION (THE GRADER)
  // -------------------------------------------------------------
  if (isSubmitted && !isReviewMode) {
    const score = activeQuestions.reduce((acc, q, idx) => {
      const correctLetter = q.correct_answer?.toLowerCase().trim() || '';
      const isCorrect = answers[idx] === correctLetter;
      return acc + (isCorrect ? 1 : 0);
    }, 0);

    const percentage = Math.round((score / activeQuestions.length) * 100);

    return (
      <div className="p-8 text-center mt-10 max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="text-6xl mb-6">{percentage >= 50 ? '🎉' : '📊'}</div>
        <h2 className="text-3xl font-bold text-[#0B1220] mb-2">Test Complete!</h2>
        <p className="text-slate-600 mb-8 font-medium">You answered {Object.keys(answers).length} out of {activeQuestions.length} questions.</p>
        
        <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 mb-8 inline-block min-w-[250px] shadow-inner">
          <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">Final Score</p>
          <p className="text-6xl font-black text-[#E8A23D]">{score} <span className="text-3xl text-slate-400">/ {activeQuestions.length}</span></p>
          <p className={`text-xl font-bold mt-3 ${percentage >= 50 ? 'text-green-600' : 'text-red-500'}`}>
            {percentage}%
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-4">
          <button onClick={() => window.location.reload()} className="bg-slate-200 text-slate-700 hover:bg-slate-300 px-6 py-4 rounded-xl font-bold transition-colors">
            Retake Exam
          </button>
          <button 
            onClick={() => setIsReviewMode(true)} 
            className="bg-[#0B1220] text-white hover:bg-slate-800 px-6 py-4 rounded-xl font-bold transition-colors shadow-md"
          >
            Review Answers &rarr;
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // UI 3: REVIEW MODE (POST-EXAM)
  // -------------------------------------------------------------
  if (isReviewMode) {
    const isActuallyCorrect = (idx: number) => {
      return answers[idx] === activeQuestions[idx].correct_answer?.toLowerCase().trim();
    };

    return (
      <div className="flex flex-col md:flex-row max-w-6xl mx-auto min-h-[85vh] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
        <div className="flex-1 flex flex-col border-r border-slate-200">
          <div className="bg-[#E8A23D] text-white p-4 flex justify-between items-center">
            <h1 className="font-bold text-lg truncate pr-4">Review Mode: {testTitle}</h1>
            <button onClick={() => setIsReviewMode(false)} className="text-sm bg-white text-[#E8A23D] px-3 py-1 rounded font-bold">Back to Score</button>
          </div>

          <div className="p-6 sm:p-10 flex-1 overflow-y-auto">
            <div className="flex gap-4 mb-8">
              <span className="font-bold text-slate-400 text-xl">Q{currentIndex + 1}.</span>
              <p className="text-lg sm:text-xl text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                {currentQuestion?.question_text || currentQuestion?.stem}
              </p>
            </div>

            <div className="space-y-3 pl-0 sm:pl-10">
              {['a', 'b', 'c', 'd', 'e'].map((letter) => {
                const optionText = currentQuestion?.[`option_${letter}` as keyof Question];
                if (!optionText) return null;
                
                const isSelected = answers[currentIndex] === letter;
                const isCorrectLetter = currentQuestion?.correct_answer?.toLowerCase().trim() === letter;
                
                let optionStyle = 'border-slate-200 bg-white';
                if (isCorrectLetter) {
                  optionStyle = 'border-green-500 bg-green-50 ring-1 ring-green-500';
                } else if (isSelected && !isCorrectLetter) {
                  optionStyle = 'border-red-400 bg-red-50 ring-1 ring-red-400';
                }
                
                return (
                  <div key={letter} className={`flex items-center gap-4 p-4 rounded-xl border ${optionStyle}`}>
                    <span className={`font-bold uppercase ${isCorrectLetter ? 'text-green-600' : isSelected ? 'text-red-500' : 'text-slate-400'}`}>{letter}.</span>
                    <span className={`${isCorrectLetter ? 'text-green-900 font-medium' : isSelected ? 'text-red-900' : 'text-slate-700'} leading-relaxed`}>{optionText}</span>
                    {isCorrectLetter && <span className="ml-auto text-green-600 text-xl">✓</span>}
                    {isSelected && !isCorrectLetter && <span className="ml-auto text-red-500 text-xl">✗</span>}
                  </div>
                );
              })}
            </div>

            {/* Model Answer Section */}
            <div className="mt-10 pl-0 sm:pl-10">
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">Explanation</h3>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {currentQuestion?.model_answer || "No explanation provided for this question."}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
            <button onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0} className="px-6 py-3 rounded-lg font-bold border border-slate-300 text-slate-600 disabled:opacity-50 hover:bg-white transition-colors">&larr; Previous</button>
            <button onClick={() => setCurrentIndex(prev => Math.min(activeQuestions.length - 1, prev + 1))} disabled={currentIndex === activeQuestions.length - 1} className="px-6 py-3 rounded-lg font-bold bg-[#0B1220] text-white disabled:opacity-50 hover:bg-slate-800 transition-colors">Next &rarr;</button>
          </div>
        </div>

        <div className="w-full md:w-72 bg-slate-50 flex flex-col border-t md:border-t-0 border-slate-200">
          <div className="p-4 border-b border-slate-200 font-bold text-slate-700 bg-white">
            Score Palette
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="grid grid-cols-5 gap-2">
              {activeQuestions.map((_, idx) => {
                const correct = isActuallyCorrect(idx);
                const isCurrent = idx === currentIndex;
                const answered = !!answers[idx];
                
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-full aspect-square rounded font-bold text-sm flex items-center justify-center transition-all ${
                      isCurrent ? 'ring-2 ring-offset-2 ring-[#0B1220]' : ''
                    } ${
                      !answered ? 'bg-slate-200 text-slate-400' :
                      correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // UI 4: ACTIVE CBT INTERFACE
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col md:flex-row max-w-6xl mx-auto min-h-[85vh] bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-6">
      <div className="flex-1 flex flex-col border-r border-slate-200">
        <div className="bg-[#0B1220] text-white p-4 flex justify-between items-center">
          <h1 className="font-bold text-lg truncate pr-4">{testTitle}</h1>
          <div className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded font-mono text-xl text-[#E8A23D]">
            <span>⏱</span> {formatTime(timeLeft)}
          </div>
        </div>

        <div className="p-6 sm:p-10 flex-1 overflow-y-auto">
          <div className="flex gap-4 mb-8">
            <span className="font-bold text-slate-400 text-xl">Q{currentIndex + 1}.</span>
            <p className="text-lg sm:text-xl text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
              {currentQuestion?.question_text || currentQuestion?.stem}
            </p>
          </div>

          <div className="space-y-3 pl-0 sm:pl-10">
            {['a', 'b', 'c', 'd', 'e'].map((letter) => {
              const optionText = currentQuestion?.[`option_${letter}` as keyof Question];
              if (!optionText) return null;
              
              const isSelected = answers[currentIndex] === letter;
              
              return (
                <label 
                  key={letter} 
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected ? 'border-[#E8A23D] bg-amber-50 ring-1 ring-[#E8A23D]' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="radio" 
                    name={`question-${currentIndex}`} 
                    value={letter}
                    checked={isSelected}
                    onChange={() => handleSelectOption(letter)}
                    className="w-5 h-5 text-[#E8A23D] focus:ring-[#E8A23D]"
                  />
                  <span className="font-bold text-slate-400 uppercase">{letter}.</span>
                  <span className="text-slate-700 leading-relaxed">{optionText}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
          <button onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0} className="px-6 py-3 rounded-lg font-bold border border-slate-300 text-slate-600 disabled:opacity-50 disabled:bg-slate-100 hover:bg-white transition-colors">&larr; Previous</button>
          <button onClick={() => setCurrentIndex(prev => Math.min(activeQuestions.length - 1, prev + 1))} disabled={currentIndex === activeQuestions.length - 1} className="px-6 py-3 rounded-lg font-bold bg-[#0B1220] text-white disabled:opacity-50 hover:bg-slate-800 transition-colors">Next &rarr;</button>
        </div>
      </div>

      <div className="w-full md:w-72 bg-slate-50 flex flex-col border-t md:border-t-0 border-slate-200">
        <div className="p-4 border-b border-slate-200 font-bold text-slate-700 bg-white flex justify-between items-center">
          <span>Question Palette</span>
          <span className="text-xs font-bold bg-slate-200 text-slate-600 px-3 py-1 rounded-full">{Object.keys(answers).length}/{activeQuestions.length}</span>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-5 gap-2">
            {activeQuestions.map((_, idx) => {
              const isAnswered = !!answers[idx];
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-full aspect-square rounded font-bold text-sm flex items-center justify-center transition-colors ${
                    isCurrent ? 'ring-2 ring-offset-1 ring-[#0B1220] bg-white text-[#0B1220] border-2 border-[#0B1220]' :
                    isAnswered ? 'bg-[#E8A23D] text-white border border-[#E8A23D]' : 
                    'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 bg-white">
          <button onClick={() => handleFinalSubmit(false)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-xl shadow-sm transition-colors">Submit Test</button>
        </div>
      </div>
    </div>
  );
}
