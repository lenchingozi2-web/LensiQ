'use client';

import { useState } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

type Question = {
  id: string;
  type?: string; 
  question_text?: string;
  stem?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  option_e?: string;
  correct_answer?: string;
  model_answer?: string;
  image_url?: string;
  topic?: string;
}

function cleanMedicalText(rawText: string | undefined | null) {
  if (!rawText) return '';

  return rawText
    .replace(/\r\n?/g, '\n')
    .replace(/^\s*(?:\d+\.\s*)?(?:Question|Model answer|Standard answer|Answer)\s*:?\s*/i, '')
    .replace(/(^|\n)\s*·\s*/g, '$1- ')
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizedMedicalText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .toLowerCase();
}

function getTheoryPresentation(rawQuestion: string, rawAnswer: string) {
  const question = cleanMedicalText(rawQuestion);
  const answer = cleanMedicalText(rawAnswer);
  const normalizedQuestion = normalizedMedicalText(question);
  const normalizedAnswer = normalizedMedicalText(answer);

  if (!question || !answer) return { question, answer, mode: 'normal' as const };
  if (normalizedQuestion === normalizedAnswer) {
    return {
      question,
      answer: '',
      mode: 'duplicate' as const,
    };
  }

  if (normalizedAnswer.startsWith(normalizedQuestion) && normalizedAnswer.length - normalizedQuestion.length <= 300) {
    return {
      question: answer,
      answer: '',
      mode: 'embedded' as const,
    };
  }

  return { question, answer, mode: 'normal' as const };
}

export default function StudyCard({ question, index }: { question: Question, index: number }) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isFlagged, setIsFlagged] = useState(false);

  // Check if this is a theory question based on the database type
  const isTheory = question.type?.toLowerCase() === 'theory';
  const isPractical = question.type?.toLowerCase() === 'practical';

  const handleSelect = (letter: string) => {
    // Lock in the answer on the first click (Only used for MCQ)
    if (!selectedAnswer) {
      setSelectedAnswer(letter);
    }
  };

  const handleAskAI = async () => {
    setIsAiLoading(true);
    setAiResponse(null);
    setIsFlagged(false);
    
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: question.id,
          questionText: question.question_text || question.stem,
          options: {
            a: question.option_a, b: question.option_b, c: question.option_c, d: question.option_d, e: question.option_e
          },
          correctAnswer: question.correct_answer,
          modelAnswer: question.model_answer
        })
      });

      const data = await response.json();
      
      if (response.ok && data.content) {
        setAiResponse(data.content);
        if (data.flagged) setIsFlagged(true);
      } else {
        setAiResponse("Failed to connect to the AI Tutor. Please try again.");
      }
    } catch {
      setAiResponse("A network error occurred while reaching out to the AI.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const rawQuestionText = question.question_text || question.stem || '';
  const rawTheoryAnswer = question.correct_answer || question.model_answer || 'No predefined answer provided for this theory question.';
  const theoryPresentation = isTheory ? getTheoryPresentation(rawQuestionText, rawTheoryAnswer) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
      {/* Question Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-6 flex gap-4">
        <span className="font-bold text-slate-400 text-xl mt-1">Q{index + 1}.</span>
        <div className="prose prose-slate max-w-none text-lg sm:text-xl font-medium leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {isTheory ? theoryPresentation?.question : cleanMedicalText(rawQuestionText)}
          </ReactMarkdown>
        </div>
      </div>

      {question.image_url && (
        <div className="border-b border-slate-200 bg-slate-950/5 p-4 sm:p-6">
          <div className="relative mx-auto aspect-[4/3] max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Image
              src={question.image_url}
              alt={`Practical specimen for question ${index + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/*              THEORY RENDER LOGIC           */}
      {/* ========================================== */}
            {isTheory && (
        <div className="p-4 sm:p-6 bg-white animate-in fade-in duration-300">
          {theoryPresentation?.mode === 'normal' && (
            <>
              <h3 className="font-bold text-slate-900 text-lg mb-3">Standard Answer:</h3>
              <div className="prose prose-slate max-w-none mb-6">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {theoryPresentation.answer || 'No predefined answer provided for this theory question.'}
                </ReactMarkdown>
              </div>
            </>
          )}
          {theoryPresentation?.mode === 'duplicate' && (
            <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              No separate model answer was supplied in the source record.
            </p>
          )}
          {/* Embedded records are presented once in the question header as a complete teaching point. */}
          {/* AI Tutor Area for Theory */}
          {!aiResponse ? (
            <button 
              onClick={handleAskAI}
              disabled={isAiLoading}
              className="w-full sm:w-auto bg-slate-900 text-[#E8A23D] px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-70 shadow-md"
            >
              {isAiLoading ? (
                <span className="animate-pulse">✨ Analyzing Theory...</span>
              ) : (
                <><span>🤖</span> Ask AI to Elaborate</>
              )}
            </button>
          ) : (
            <div className={`border rounded-xl p-6 mt-4 animate-in fade-in duration-300 ${isFlagged ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className={isFlagged ? 'text-red-600 text-xl' : 'text-indigo-600 text-xl'}>
                  {isFlagged ? '⚠️' : '✨'}
                </span>
                <h4 className={`font-bold ${isFlagged ? 'text-red-900' : 'text-indigo-900'}`}>
                  {isFlagged ? 'AI Tutor Note: Potential Error Detected' : 'AI Tutor Elaboration'}
                </h4>
              </div>
              <div className={`prose max-w-none ${isFlagged ? 'prose-red text-red-800' : 'prose-indigo text-indigo-800'}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {aiResponse}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {isPractical && (
        <div className="p-4 sm:p-6 bg-white border-t border-slate-200">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h3 className="font-bold text-slate-900 text-lg">Practical Answer</h3>
            {question.topic && <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{question.topic}</span>}
          </div>
          <div className="prose prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {cleanMedicalText(question.model_answer || question.correct_answer || 'No predefined practical answer provided.')}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/*                MCQ RENDER LOGIC            */}
      {/* ========================================== */}
      {!isTheory && !isPractical && (
        <>
          {/* Interactive Options List */}
          <div className="p-4 sm:p-6 space-y-3">
            {['a', 'b', 'c', 'd', 'e'].map((letter) => {
              const optionText = question[`option_${letter}` as keyof Question];
              if (!optionText) return null;
              
              const isCorrectAnswer = question.correct_answer?.toLowerCase().trim() === letter;
              const isSelected = selectedAnswer === letter;
              
              let optionStyle = 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer';
              
              if (selectedAnswer) {
                if (isCorrectAnswer) {
                  optionStyle = 'border-green-500 bg-green-50 ring-1 ring-green-500';
                } else if (isSelected && !isCorrectAnswer) {
                  optionStyle = 'border-red-400 bg-red-50 ring-1 ring-red-400';
                } else {
                  optionStyle = 'border-slate-100 bg-slate-50 opacity-50 cursor-default';
                }
              }

              return (
                <button 
                  key={letter} 
                  onClick={() => handleSelect(letter)}
                  disabled={!!selectedAnswer}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all ${optionStyle}`}
                >
                  <span className={`font-bold uppercase ${(selectedAnswer && isCorrectAnswer) ? 'text-green-600' : (isSelected && !isCorrectAnswer) ? 'text-red-500' : 'text-slate-400'}`}>{letter}.</span>
                  <span className={`${(selectedAnswer && isCorrectAnswer) ? 'text-green-900 font-medium' : (isSelected && !isCorrectAnswer) ? 'text-red-900 font-medium' : 'text-slate-700'} leading-relaxed`}>{optionText}</span>
                  
                  {selectedAnswer && isCorrectAnswer && <span className="ml-auto text-green-600 text-xl font-bold">✓</span>}
                  {isSelected && !isCorrectAnswer && <span className="ml-auto text-red-500 text-xl font-bold">✗</span>}
                </button>
              );
            })}
          </div>

          {/* Model Answer & AI Section (Only shows AFTER an MCQ option is clicked) */}
          {selectedAnswer && (
            <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 animate-in fade-in slide-in-from-top-2 duration-300">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">Explanation</h3>
              <div className="prose prose-slate max-w-none mb-6">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {cleanMedicalText(question.model_answer || "No predefined explanation provided for this question.")}
                </ReactMarkdown>
              </div>

              {/* AI Tutor Area for MCQ */}
              {!aiResponse ? (
                <button 
                  onClick={handleAskAI}
                  disabled={isAiLoading}
                  className="bg-[#0B1220] text-white px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-70"
                >
                  {isAiLoading ? (
                    <span className="animate-pulse">✨ Waking up AI Tutor...</span>
                  ) : (
                    <><span>✨</span> Ask AI for deeper breakdown</>
                  )}
                </button>
              ) : (
                <div className={`border rounded-xl p-6 mt-4 animate-in fade-in duration-300 ${isFlagged ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={isFlagged ? 'text-red-600 text-xl' : 'text-indigo-600 text-xl'}>
                      {isFlagged ? '⚠️' : '✨'}
                    </span>
                    <h4 className={`font-bold ${isFlagged ? 'text-red-900' : 'text-indigo-900'}`}>
                      {isFlagged ? 'AI Tutor Note: Potential Error Detected' : 'AI Tutor Explanation'}
                    </h4>
                  </div>
                  <div className={`prose max-w-none ${isFlagged ? 'prose-red text-red-800' : 'prose-indigo text-indigo-800'}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {aiResponse}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
