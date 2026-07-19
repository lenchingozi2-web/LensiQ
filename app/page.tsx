import Link from 'next/link';

export default function Home() {
  return (
    <main className="w-full max-w-4xl mx-auto flex flex-col items-center p-4">
      {/* The non-clickable Greeting Banner */}
      <div className="w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-8 mt-4 text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome to Lensiq AI</h1>
        <p className="text-slate-500">Select a module below to begin your session.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Card 1: AI Teaching Mode */}
        <Link href="/teach" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-purple-400 transition-all group">
          <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">🤖</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">AI Teaching Mode</h2>
          <p className="text-center text-slate-500 text-xs">Chat with your AI smart tutor for deep explanations.</p>
        </Link>

        {/* Card 2: Study Mode */}
        <Link href="/study" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-amber-400 transition-all group">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">📚</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Study Mode</h2>
          <p className="text-center text-slate-500 text-xs">Review flashcards and learn at your own pace.</p>
        </Link>

        {/* Card 3: Mock Exam Mode */}
        <Link href="/exam" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-400 transition-all group">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">⏱️</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Mock Exam</h2>
          <p className="text-center text-slate-500 text-xs">Test your knowledge under real exam conditions.</p>
        </Link>
      </div>
    </main>
  );
}
