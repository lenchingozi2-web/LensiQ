'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ConceptCardCanvasProps = {
  title: string;
  markdown: string;
};

export default function ConceptCardCanvas({ title, markdown }: ConceptCardCanvasProps) {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto p-6 sm:p-12">
      <article className="w-full max-w-3xl rounded-[2rem] border border-[#E8A23D]/30 bg-[#0B1220]/85 p-6 text-white shadow-[0_24px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[#E8A23D]">Digital chalkboard</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{title}</h1>
        <div className="prose prose-invert mt-6 max-w-none prose-headings:text-white prose-a:text-[#E8A23D] prose-strong:text-white">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
