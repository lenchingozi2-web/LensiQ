"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Role = 'user' | 'assistant';
type Message = { id?: string; role: Role; content: string };
type Conversation = {
  id: string;
  course_name: string;
  title: string;
  created_at: string;
  updated_at: string;
};
type Attachment = { id: string; file_name: string; mime_type: string; size_bytes: number };

const COURSES = [
  'Pharmacology',
  'Microbiology',
  'Chemical Pathology',
  'Anatomical Pathology',
  'Haematology / Immunology',
];

export default function TeachingRoom() {
  const [courseName, setCourseName] = useState('Pharmacology');
  const [currentInput, setCurrentInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/teaching/conversations');
        if (!response.ok) return;
        const data = await response.json();
        setConversations(data.conversations ?? []);
      } finally {
        setHistoryLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, loading]);

  const loadConversations = async () => {
    try {
      const response = await fetch('/api/teaching/conversations');
      if (!response.ok) return;
      const data = await response.json();
      setConversations(data.conversations ?? []);
    } finally {
      setHistoryLoading(false);
    }
  };

  const createConversation = async (course: string) => {
    const response = await fetch('/api/teaching/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseName: course }),
    });
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
    if (!response.ok) {
      setError('Unable to load this teaching session.');
      return;
    }
    const data = await response.json();
    setConversationId(data.conversation.id);
    setCourseName(data.conversation.course_name);
    setMessages(data.messages ?? []);
    setAttachments(data.attachments ?? []);
    shouldAutoScrollRef.current = true;
  };

  const uploadAttachment = async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('conversationId', id);
    formData.append('file', file);
    const response = await fetch('/api/teaching/attachments', { method: 'POST', body: formData });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Unable to upload attachment.');
    }
    const data = await response.json();
    setAttachments((previous) => [...previous, data.attachment]);
  };

  const persistMessage = async (id: string, message: Message) => {
    const response = await fetch('/api/teaching/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: id, role: message.role, content: message.content }),
    });
    if (!response.ok) throw new Error('Unable to save this teaching message.');
  };

  const handleNewSession = () => {
    if (loading) return;
    setConversationId(null);
    setMessages([]);
    setAttachments([]);
    setSelectedFiles([]);
    setShowPaywall(false);
    setError('');
  };

  const handleTeach = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmedInput = currentInput.trim();
    if (!trimmedInput || loading) return;

    setLoading(true);
    setError('');
    setShowPaywall(false);
    shouldAutoScrollRef.current = true;

    const userMessage: Message = { role: 'user', content: trimmedInput };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setCurrentInput('');

    try {
      const activeConversation = conversationId
        ? { id: conversationId }
        : await createConversation(courseName);
      const activeConversationId = activeConversation.id;

      for (const file of selectedFiles) await uploadAttachment(activeConversationId, file);
      setSelectedFiles([]);
      await persistMessage(activeConversationId, userMessage);

      const response = await fetch('/api/teach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 403 || data.error === 'limit_reached') setShowPaywall(true);
        else setError(data.error || 'Something went wrong.');
        setMessages(messages);
        setCurrentInput(trimmedInput);
        return;
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
            const data = eventChunk
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.replace(/^data:\s?/, ''))
              .join('\n');
            if (!data || data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const contentChunk = parsed.choices?.[0]?.delta?.content || '';
              if (!contentChunk) continue;
              assistantResponse += contentChunk;
              setMessages((previous) => {
                const updated = [...previous];
                updated[updated.length - 1] = { role: 'assistant', content: assistantResponse };
                return updated;
              });
            } catch {
              // Incomplete SSE frames remain buffered until the next network read.
            }
          }
        }
      }

      if (assistantResponse) {
        await persistMessage(activeConversationId, { role: 'assistant', content: assistantResponse });
      }
      await loadConversations();
    } catch {
      setError('The teaching session could not be completed. Please try again.');
      setMessages(messages);
      setCurrentInput(trimmedInput);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = () => {
    const element = scrollAreaRef.current;
    if (!element) return;
    shouldAutoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleTeach();
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-slate-50 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-80 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Teaching Room</p>
            <h2 className="text-lg font-extrabold text-[#0B1220]">Your sessions</h2>
          </div>
          <button type="button" onClick={handleNewSession} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
            New
          </button>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto p-3 lg:max-h-none lg:flex-1">
          {historyLoading && <p className="p-3 text-sm text-slate-400">Loading history…</p>}
          {!historyLoading && conversations.length === 0 && <p className="p-3 text-sm leading-6 text-slate-400">Your completed teaching sessions will appear here.</p>}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => void loadConversation(conversation.id)}
              className={`w-full rounded-xl p-3 text-left transition-colors ${conversation.id === conversationId ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
            >
              <span className="block truncate text-sm font-bold">{conversation.title}</span>
              <span className={`mt-1 block text-xs ${conversation.id === conversationId ? 'text-slate-300' : 'text-slate-400'}`}>{conversation.course_name}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div ref={scrollAreaRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-4xl">
            {messages.length === 0 && !showPaywall && (
              <div className="mt-10 text-center sm:mt-20">
                <span className="mb-6 block text-6xl">👨‍⚕️</span>
                <h1 className="mb-4 text-3xl font-black tracking-tight text-[#0B1220] sm:text-4xl">Dynamic Teaching Room</h1>
                <p className="mx-auto mb-10 max-w-xl text-lg text-slate-500">Select a branch and request a topic. LenxiQ will teach you, test you with past questions, and answer follow-ups.</p>
                <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                  <label htmlFor="course" className="mb-2 block text-sm font-bold text-slate-900">Select your branch</label>
                  <select id="course" value={courseName} onChange={(event) => setCourseName(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-800 outline-none focus:border-[#E8A23D] focus:ring-2 focus:ring-[#E8A23D]/20">
                    {COURSES.map((course) => <option key={course} value={course}>{course}</option>)}
                  </select>
                </div>
              </div>
            )}

            {showPaywall && (
              <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-800 p-10 text-center shadow-xl">
                <span className="mb-6 block text-5xl">🔒</span>
                <h3 className="mb-3 text-3xl font-black text-white">Teaching limit reached</h3>
                <p className="mb-8 text-lg text-slate-300">Upgrade to premium for unlimited lectures and follow-up teaching sessions.</p>
                <Link href="/pricing" className="inline-block rounded-xl bg-[#E8A23D] px-10 py-4 font-black text-slate-900 shadow-lg hover:bg-amber-500">View Premium Plans</Link>
              </div>
            )}

            {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center font-medium text-red-800">{error}</div>}

            <div className="space-y-8 pb-4">
              {messages.map((message, index) => (
                <div key={message.id ?? `${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[95%] rounded-3xl p-6 sm:max-w-[85%] ${message.role === 'user' ? 'rounded-br-none bg-[#0B1220] text-white shadow-md' : 'rounded-bl-none border border-slate-200 bg-white shadow-sm'}`}>
                    {message.role === 'user' ? <p className="text-lg font-medium">{message.content}</p> : (
                      <div className="prose prose-slate max-w-none leading-relaxed prose-headings:text-[#0B1220] prose-strong:text-[#E8A23D]">
                        {message.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown> : <span className="italic text-slate-400">Thinking…</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-3xl rounded-bl-none border border-slate-200 bg-white p-5 shadow-sm"><span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#E8A23D]" /><span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#E8A23D] [animation-delay:100ms]" /><span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#E8A23D] [animation-delay:200ms]" /></div></div>}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {!showPaywall && (
          <div className="border-t border-slate-200 bg-white p-4">
            <div className="relative mx-auto max-w-4xl">
              {(selectedFiles.length > 0 || attachments.length > 0) && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachments.map((attachment) => <span key={attachment.id} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Saved: {attachment.file_name}</span>)}
                  {selectedFiles.map((file) => <span key={`${file.name}-${file.lastModified}`} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Ready: {file.name}</span>)}
                </div>
              )}
              <form onSubmit={handleTeach} className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-slate-50 p-2 shadow-sm transition-all focus-within:border-[#E8A23D] focus-within:ring-2 focus-within:ring-[#E8A23D]/20">
                <input ref={fileInputRef} type="file" className="hidden" accept="application/pdf,.ppt,.pptx,.docx,image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/webm" multiple onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mb-1 flex-shrink-0 rounded-xl p-3 text-slate-500 hover:bg-slate-200 hover:text-slate-900" aria-label="Attach lecture material">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l9.193-9.193a3 3 0 0 1 4.243 4.243l-9.193 9.193a1.5 1.5 0 0 1-2.121-2.121l8.486-8.486" /></svg>
                </button>
                <textarea value={currentInput} onChange={(event) => setCurrentInput(event.target.value)} onKeyDown={handleKeyDown} placeholder={messages.length === 0 ? `Ask a topic in ${courseName}…` : 'Type your answer or a follow-up question…'} className="w-full resize-none bg-transparent px-3 py-3 font-medium text-slate-900 outline-none placeholder:text-slate-400" rows={2} />
                <button type="submit" disabled={loading || !currentInput.trim()} className="mb-1 mr-1 flex-shrink-0 rounded-xl bg-[#E8A23D] p-3 font-bold text-[#0B1220] shadow-sm transition-colors hover:bg-amber-500 disabled:opacity-40" aria-label="Send teaching question">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg>
                </button>
              </form>
              <p className="mt-2 text-center text-xs font-medium text-slate-400">Press <kbd className="rounded border border-slate-200 bg-slate-100 px-1">Enter</kbd> to send, <kbd className="rounded border border-slate-200 bg-slate-100 px-1">Shift + Enter</kbd> for a new line.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
