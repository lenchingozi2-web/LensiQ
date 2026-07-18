"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function TeachingRoom() {
  const [courseName, setCourseName] = useState('Pharmacology');
  const [currentInput, setCurrentInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleTeach = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentInput.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, content: currentInput }];
    setMessages(newMessages);
    setCurrentInput('');
    setLoading(true);
    setError('');
    setShowPaywall(false);

    try {
      const res = await fetch('/api/teach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName, messages: newMessages }),
      });

      // If the response isn't OK, it's likely our limit error
      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'limit_reached') {
          setShowPaywall(true);
        } else {
          setError(data.error || 'Something went wrong.');
        }
        setMessages(messages);
        setCurrentInput(newMessages[newMessages.length - 1].content);
        setLoading(false);
        return;
      }

      // Prepare an empty assistant message box in the UI
      setMessages([...newMessages, { role: 'assistant', content: '' }]);
      setLoading(false); // Turn off the bouncing dots because streaming starts now!

      // Read the live stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            // Only parse lines that start with data: (and ignore the [DONE] signal)
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.replace(/^data: /, ''));
                // Append the incoming chunk to the total response
                const contentChunk = parsed.choices[0]?.delta?.content || '';
                assistantResponse += contentChunk;
                
                // Instantly update the last message box with the new text
                setMessages((prev) => {
                  const updatedMessages = [...prev];
                  updatedMessages[updatedMessages.length - 1] = {
                    role: 'assistant',
                    content: assistantResponse
                  };
                  return updatedMessages;
                });
              } catch (e) {
                // Ignore silent JSON parsing errors on broken chunks
              }
            }
          }
        }
      }

    } catch (err) {
      setError('Failed to connect to the AI Tutor. Please try again.');
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTeach();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      
      {/* Scrollable Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          
          {messages.length === 0 && !showPaywall && (
            <div className="text-center mt-10 sm:mt-20">
              <span className="text-6xl mb-6 block">👨‍⚕️</span>
              <h1 className="text-3xl sm:text-4xl font-black text-[#0B1220] tracking-tight mb-4">
                Dynamic Teaching Room
              </h1>
              <p className="text-slate-500 text-lg max-w-xl mx-auto mb-10">
                Select a branch and request a topic. LensiqAI will teach you, test you with past questions, and answer your follow-ups.
              </p>
              
              <div className="max-w-sm mx-auto bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-left">
                <label className="block text-sm font-bold text-slate-900 mb-2">Select your Branch:</label>
                <select 
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#E8A23D] focus:ring-2 focus:ring-[#E8A23D]/20 outline-none bg-slate-50 font-semibold text-slate-800"
                >
                  <option value="Pharmacology">Pharmacology</option>
                  <option value="Microbiology">Microbiology</option>
                  <option value="Chemical Pathology">Chemical Pathology</option>
                  <option value="Anatomical Pathology">Anatomical Pathology</option>
                  <option value="Haematology / Immunology">Haematology / Immunology</option>
                </select>
              </div>
            </div>
          )}

          {showPaywall && (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-10 rounded-3xl shadow-xl mt-10 text-center border border-slate-700 max-w-2xl mx-auto">
              <span className="text-5xl block mb-6">🔒</span>
              <h3 className="text-3xl font-black text-white mb-3">Teaching Limit Reached</h3>
              <p className="text-slate-300 mb-8 text-lg">
                You have used all 6 of your free sessions. Upgrade to Elite Scholar to unlock unlimited lectures and follow-up chats.
              </p>
              <Link href="/pricing" className="inline-block bg-[#E8A23D] text-slate-900 font-black px-10 py-4 rounded-xl hover:bg-amber-500 transition-colors shadow-lg">
                Upgrade to Premium
              </Link>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-800 p-4 rounded-xl mb-6 font-medium text-center border border-red-200">
              ⚠️ {error}
            </div>
          )}

          <div className="space-y-8 pb-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[95%] sm:max-w-[85%] rounded-3xl p-6 ${
                  msg.role === 'user' 
                    ? 'bg-[#0B1220] text-white rounded-br-none shadow-md' 
                    : 'bg-white border border-slate-200 shadow-sm rounded-bl-none'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-lg font-medium">{msg.content}</p>
                  ) : (
                    <div className="prose prose-slate max-w-none prose-headings:text-[#0B1220] prose-h2:text-xl prose-h3:text-lg prose-strong:text-[#E8A23D] prose-p:text-slate-700 prose-li:text-slate-700 leading-relaxed">
                      {msg.content === '' ? (
                        <span className="text-slate-400 italic">Thinking...</span>
                      ) : (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => <h1 className="text-2xl font-black text-[#0B1220] mt-8 mb-4" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-xl font-extrabold text-[#0B1220] mt-8 mb-4 border-b border-slate-100 pb-2" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-lg font-bold text-slate-800 mt-6 mb-3" {...props} />,
                            p: ({node, ...props}) => <p className="text-slate-800 leading-relaxed mb-5 text-lg" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside mb-6 space-y-2 text-slate-800 text-lg" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-6 space-y-2 text-slate-800 text-lg" {...props} />,
                            li: ({node, ...props}) => <li className="ml-2" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-extrabold text-[#0B1220] bg-amber-50 px-1 rounded" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-[#E8A23D] pl-4 italic text-slate-600 my-6 bg-slate-50 py-2 pr-4 rounded-r-lg" {...props} />,
                            table: ({node, ...props}) => (
                              <div className="overflow-x-auto my-6 rounded-xl border border-slate-300 shadow-sm">
                                <table className="w-full text-left border-collapse bg-white" {...props} />
                              </div>
                            ),
                            thead: ({node, ...props}) => <thead className="bg-slate-100 border-b border-slate-300" {...props} />,
                            th: ({node, ...props}) => <th className="px-4 py-3 font-bold text-slate-900 border border-slate-300" {...props} />,
                            td: ({node, ...props}) => <td className="px-4 py-3 text-slate-700 border border-slate-300" {...props} />,
                            tr: ({node, ...props}) => <tr className="even:bg-slate-50 hover:bg-slate-100 transition-colors" {...props} />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl rounded-bl-none p-5 flex gap-2 items-center">
                  <div className="w-2.5 h-2.5 bg-[#E8A23D] rounded-full animate-bounce"></div>
                  <div className="w-2.5 h-2.5 bg-[#E8A23D] rounded-full animate-bounce delay-100"></div>
                  <div className="w-2.5 h-2.5 bg-[#E8A23D] rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

        </div>
      </div>

      {!showPaywall && (
        <div className="bg-white border-t border-slate-200 p-4">
          <div className="max-w-4xl mx-auto relative">
            <form onSubmit={handleTeach} className="relative flex items-end gap-2 bg-slate-50 border border-slate-300 rounded-2xl p-2 focus-within:border-[#E8A23D] focus-within:ring-2 focus-within:ring-[#E8A23D]/20 transition-all shadow-sm">
              
              <textarea
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={messages.length === 0 ? `Ask a topic in ${courseName}...` : "Type your answer or a follow-up question..."}
                className="w-full bg-transparent outline-none resize-none px-3 py-3 text-slate-900 font-medium placeholder-slate-400"
                rows={2}
              />
              
              <button 
                type="submit" 
                disabled={loading || !currentInput.trim()}
                className="bg-[#E8A23D] text-[#0B1220] p-3 rounded-xl font-bold hover:bg-amber-500 transition-colors disabled:opacity-40 disabled:hover:bg-[#E8A23D] mb-1 mr-1 shadow-sm flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </form>
            <p className="text-center text-xs text-slate-400 mt-2 font-medium">
              Press <kbd className="bg-slate-100 border border-slate-200 px-1 rounded">Enter</kbd> to send, <kbd className="bg-slate-100 border border-slate-200 px-1 rounded">Shift + Enter</kbd> for a new line.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
