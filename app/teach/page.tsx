'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Role = 'user' | 'assistant';
type Message = { id?: string; role: Role; content: string };
type Conversation = { id: string; course_name: string; title: string; created_at: string; updated_at: string };
type Attachment = { id: string; file_name: string; mime_type: string; size_bytes: number };
type SpeechRecognitionResultEvent = { resultIndex: number; results: { length: number; [index: number]: { 0: { transcript: string }; isFinal: boolean } } };
type SpeechRecognitionInstance = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: SpeechRecognitionResultEvent) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global { interface Window { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor } }

const COURSES = ['Pharmacology', 'Microbiology', 'Chemical Pathology', 'Anatomical Pathology', 'Haematology / Immunology'];

function MicIcon({ active = false }: { active?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-5 w-5 ${active ? 'animate-pulse' : ''}`} aria-hidden="true"><rect x="8" y="3" width="8" height="12" rx="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 11a7 7 0 0 0 14 0M12 18v3m-3 0h6" /></svg>;
}

function TeachingRoom() {
  const searchParams = useSearchParams();
  const topicFocus = searchParams.get('topic')?.trim() ?? '';
  const initialCourse = searchParams.get('course')?.trim() ?? '';
  const [courseName, setCourseName] = useState(initialCourse || 'Pharmacology');
  const [currentInput, setCurrentInput] = useState(topicFocus ? `Teach me ${topicFocus}. Start with the core concepts, then connect it to relevant past questions.` : '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const historyContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const speechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/teaching/conversations');
        if (!response.ok) return;
        const data = await response.json();
        setConversations(data.conversations ?? []);
      } finally { setHistoryLoading(false); }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      const element = scrollAreaRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  useEffect(() => {
    if (!showHistory) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (historyContainerRef.current && !historyContainerRef.current.contains(event.target as Node)) setShowHistory(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowHistory(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showHistory]);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/teaching/conversations');
      if (!response.ok) return;
      const data = await response.json();
      setConversations(data.conversations ?? []);
    } finally { setHistoryLoading(false); }
  };

  const createConversation = async (course: string, title: string) => {
    const response = await fetch('/api/teaching/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseName: course, title: title.slice(0, 120) }) });
    if (!response.ok) throw new Error('Unable to create a teaching session.');
    const data = await response.json();
    setConversationId(data.conversation.id);
    setConversations((previous) => [data.conversation, ...previous]);
    return data.conversation as Conversation;
  };

  const loadConversation = async (id: string) => {
    if (loading) return;
    setError('');
    const response = await fetch(`/api/teaching/conversations/${id}`);
    if (!response.ok) { setError('Unable to load this teaching session.'); return; }
    const data = await response.json();
    setConversationId(data.conversation.id);
    setCourseName(data.conversation.course_name);
    setMessages(data.messages ?? []);
    setAttachments(data.attachments ?? []);
    setShowHistory(false);
    shouldAutoScrollRef.current = true;
  };

  const uploadAttachment = async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('conversationId', id);
    formData.append('file', file);
    const response = await fetch('/api/teaching/attachments', { method: 'POST', body: formData });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Unable to upload attachment.'); }
    const data = await response.json();
    setAttachments((previous) => [...previous, data.attachment]);
  };

  const persistMessage = async (id: string, message: Message) => {
    const response = await fetch('/api/teaching/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: id, role: message.role, content: message.content }) });
    if (!response.ok) throw new Error('Unable to save this teaching message.');
  };

  const handleNewSession = () => {
    if (loading) return;
    recognitionRef.current?.stop();
    setIsListening(false);
    setConversationId(null); setMessages([]); setAttachments([]); setSelectedFiles([]); setShowPaywall(false); setShowHistory(false); setError(''); setCurrentInput('');
  };

  const toggleListening = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : undefined;
    if (!Recognition) { setError('Voice typing is not supported in this browser. Try Chrome on Android or Safari with microphone permission enabled.'); return; }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-NG';
    const prefix = currentInput.trim();
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
      const nextText = `${prefix}${prefix && transcript ? ' ' : ''}${transcript}`.trimStart();
      setCurrentInput(nextText);
    };
    recognition.onerror = (event) => { setIsListening(false); setError(event.error === 'not-allowed' ? 'Microphone access was blocked. Allow microphone permission and try again.' : 'Voice typing stopped. Please try again.'); };
    recognition.onend = () => { recognitionRef.current = null; setIsListening(false); };
    recognitionRef.current = recognition;
    setError('');
    setIsListening(true);
    recognition.start();
  };

  const handleTeach = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmedInput = currentInput.trim();
    if (!trimmedInput || loading) return;
    setLoading(true); setError(''); setShowPaywall(false); shouldAutoScrollRef.current = true;
    const userMessage: Message = { role: 'user', content: trimmedInput };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages); setCurrentInput('');
    try {
      const activeConversation = conversationId ? { id: conversationId } : await createConversation(courseName, topicFocus || trimmedInput);
      const activeConversationId = activeConversation.id;
      for (const file of selectedFiles) await uploadAttachment(activeConversationId, file);
      setSelectedFiles([]); await persistMessage(activeConversationId, userMessage);
      const response = await fetch('/api/teach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseName, messages: nextMessages.map(({ role, content }) => ({ role, content })) }) });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 403 || data.error === 'limit_reached') setShowPaywall(true); else setError(data.error || 'Something went wrong.');
        setMessages(messages); setCurrentInput(trimmedInput); return;
      }
      setMessages([...nextMessages, { role: 'assistant', content: '' }]);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';
      let sseBuffer = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const events = sseBuffer.split(/\r?\n\r?\n/);
          sseBuffer = events.pop() || '';
          for (const eventChunk of events) {
            const data = eventChunk.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.replace(/^data:\s?/, '')).join('\n');
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const contentChunk = parsed.choices?.[0]?.delta?.content || '';
              if (!contentChunk) continue;
              assistantResponse += contentChunk;
              setMessages((previous) => { const updated = [...previous]; updated[updated.length - 1] = { role: 'assistant', content: assistantResponse }; return updated; });
            } catch { /* Keep incomplete SSE frames buffered. */ }
          }
        }
      }
      if (assistantResponse) await persistMessage(activeConversationId, { role: 'assistant', content: assistantResponse });
      await loadConversations();
    } catch { setError('The teaching session could not be completed. Please try again.'); setMessages(messages); setCurrentInput(trimmedInput); }
    finally { setLoading(false); }
  };

  const handleScroll = () => {
    const element = scrollAreaRef.current;
    if (element) shouldAutoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleTeach(); }
  };

  return (
    <div className="flex min-h-[calc(100vh-4.5rem)] flex-col bg-[#F6F8FB]">
      <header className="sticky top-[4.5rem] z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3"><Link href="/curriculum" className="hidden text-sm font-black text-slate-400 hover:text-[#0B1220] sm:block">← Study path</Link><span className="hidden h-5 w-px bg-slate-200 sm:block" /><div className="min-w-0"><p className="truncate text-sm font-black text-[#0B1220]">Teaching Room</p><p className="truncate text-xs font-bold text-slate-400">{courseName} · source-prioritised, broadly enriched</p></div></div>
          <div ref={historyContainerRef} className="relative flex shrink-0 items-center gap-2"><Link href="/pricing" className="rounded-lg border border-[#E8A23D]/50 bg-[#FFF8E9] px-3 py-2 text-xs font-black text-[#8B5709] hover:bg-[#FFF0CF]">Plans</Link><button type="button" onClick={() => setShowHistory((open) => !open)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-slate-400" aria-expanded={showHistory}>History{conversations.length > 0 ? ` · ${conversations.length}` : ''}</button><button type="button" onClick={handleNewSession} className="rounded-lg bg-[#0B1220] px-3 py-2 text-xs font-black text-white hover:bg-slate-800">New</button>
            {showHistory && <div className="absolute right-0 top-12 z-50 w-[min(88vw,22rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"><div className="flex items-center justify-between px-3 py-2"><p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Continue a session</p><button type="button" onClick={() => setShowHistory(false)} className="text-xs font-bold text-slate-400">Close</button></div>{historyLoading && <p className="p-3 text-sm text-slate-400">Loading history…</p>}{!historyLoading && conversations.length === 0 && <p className="p-3 text-sm leading-6 text-slate-500">Your completed teaching sessions will appear here.</p>}{conversations.slice(0, 12).map((conversation) => <button key={conversation.id} type="button" onClick={() => void loadConversation(conversation.id)} className={`w-full rounded-xl px-3 py-3 text-left hover:bg-slate-50 ${conversation.id === conversationId ? 'bg-slate-100' : ''}`}><span className="block truncate text-sm font-black text-slate-800">{conversation.title}</span><span className="mt-1 block truncate text-xs font-bold text-slate-400">{conversation.course_name}</span></button>)}</div>}
          </div>
        </div>
      </header>

      <main ref={scrollAreaRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 pb-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl pt-8 sm:pt-12">
          {messages.length === 0 && !showPaywall && <div className="mx-auto max-w-3xl pb-8 text-center sm:pb-14"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B1220] text-xl font-black text-[#E8A23D] shadow-lg">LQ</div><p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#9A5D00]">Guided medical teaching</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[#0B1220] sm:text-5xl">Build understanding, not just notes.</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600">Start from your course material and preserved past questions. LenxiQ AI then adds broader medical explanation when it helps connect the gaps.</p>{topicFocus && <p className="mx-auto mt-6 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">Topic focus loaded: {topicFocus}. Your first message is ready in the composer below.</p>}<div className="mx-auto mt-8 max-w-sm rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><label htmlFor="course" className="mb-2 block text-sm font-black text-slate-900">Select your branch</label><select id="course" value={courseName} onChange={(event) => setCourseName(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-800 outline-none focus:border-[#E8A23D] focus:ring-2 focus:ring-[#E8A23D]/20">{COURSES.map((course) => <option key={course} value={course}>{course}</option>)}</select></div><div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-bold text-slate-400"><Link href="/search" className="rounded-full bg-white px-3 py-2 shadow-sm hover:text-[#0B1220]">Search past questions</Link><Link href="/voice" className="rounded-full bg-white px-3 py-2 shadow-sm hover:text-[#0B1220]">Use Voice Tutor</Link><Link href="/voice?mode=class" className="rounded-full bg-white px-3 py-2 shadow-sm hover:text-[#0B1220]">Enter Live Class</Link></div></div>}
          {showPaywall && <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-center shadow-xl sm:p-10"><span className="mb-5 block text-3xl font-black text-[#E8A23D]">Premium access</span><h3 className="mb-3 text-3xl font-black text-white">Continue teaching without limits.</h3><p className="mb-8 text-base leading-7 text-slate-300">Upgrade to premium for unlimited lectures, follow-up teaching, practical material, and complete learning access.</p><Link href="/pricing" className="inline-block rounded-xl bg-[#E8A23D] px-8 py-3.5 font-black text-slate-900 shadow-lg hover:bg-amber-500">View subscription plans</Link></div>}
          {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-bold text-red-800">{error}</div>}
          <div className="space-y-8 pb-4">{messages.map((message, index) => <div key={message.id ?? `${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[96%] rounded-3xl p-5 sm:max-w-[85%] sm:p-6 ${message.role === 'user' ? 'rounded-br-none bg-[#0B1220] text-white shadow-md' : 'rounded-bl-none border border-slate-200 bg-white shadow-sm'}`}>{message.role === 'user' ? <p className="text-base font-medium leading-7">{message.content}</p> : <div className="prose prose-slate max-w-none leading-relaxed prose-headings:text-[#0B1220] prose-strong:text-[#E8A23D]">{message.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown> : <span className="italic text-slate-400">Thinking…</span>}</div>}</div></div>)}{loading && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-3xl rounded-bl-none border border-slate-200 bg-white p-5 shadow-sm"><span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#E8A23D]" /><span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#E8A23D] [animation-delay:100ms]" /><span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#E8A23D] [animation-delay:200ms]" /></div></div>}<div ref={messagesEndRef} /></div>
        </div>
      </main>

      {!showPaywall && <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-6"><div className="mx-auto max-w-4xl">{(selectedFiles.length > 0 || attachments.length > 0) && <div className="mb-2 flex flex-wrap gap-2">{attachments.map((attachment) => <span key={attachment.id} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Saved: {attachment.file_name}</span>)}{selectedFiles.map((file) => <span key={`${file.name}-${file.lastModified}`} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Ready: {file.name}</span>)}</div>}<form onSubmit={handleTeach} className="flex items-end gap-1 rounded-2xl border border-slate-300 bg-slate-50 p-2 shadow-sm focus-within:border-[#E8A23D] focus-within:ring-2 focus-within:ring-[#E8A23D]/20"><input ref={fileInputRef} type="file" className="hidden" accept="application/pdf,.ppt,.pptx,.docx,image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/webm" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} /><button type="button" onClick={() => fileInputRef.current?.click()} className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200 hover:text-slate-900" aria-label="Attach lecture material" title="Attach lecture material"><span className="text-xl">＋</span></button><button type="button" onClick={toggleListening} disabled={loading || !speechSupported} className={`mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isListening ? 'bg-red-100 text-red-700' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-900'} disabled:cursor-not-allowed disabled:opacity-40`} aria-label={isListening ? 'Stop voice typing' : 'Use microphone to type'} title={speechSupported ? 'Speak and transcribe into the composer' : 'Voice typing is not supported in this browser'}><MicIcon active={isListening} /></button><textarea value={currentInput} onChange={(event) => setCurrentInput(event.target.value)} onKeyDown={handleKeyDown} placeholder={isListening ? 'Listening… speak your question' : messages.length === 0 ? `Ask a topic in ${courseName}…` : 'Type or dictate a follow-up question…'} className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-3 text-base font-medium leading-6 text-slate-900 outline-none placeholder:text-slate-400" rows={1} /><button type="submit" disabled={loading || !currentInput.trim()} className="mb-1 mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8A23D] font-bold text-[#0B1220] shadow-sm hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send teaching question" title="Send teaching question"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg></button></form><div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-bold text-slate-400"><span>{isListening ? 'Voice input is being transcribed into the text box.' : speechSupported ? 'Tap the microphone to dictate, then review before sending.' : 'Microphone typing is unavailable in this browser.'}</span><span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span></div></div></footer>}
    </div>
  );
}

export default function TeachingPage() {
  return <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-sm font-bold text-slate-500">Loading Teaching Room…</div>}><TeachingRoom /></Suspense>;
}
