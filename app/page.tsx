import Link from 'next/link';

export default function Home() {
  return (
    <main className="w-full max-w-4xl mx-auto flex flex-col items-center p-4">
      <div className="w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-8 mt-4 text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Welcome to Lensiq AI</h1>
        <p className="text-slate-500">Select a module below to begin your session.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Notice the href is now a real route: "/study" */}
        <Link href="/study" className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-amber-400 hover:shadow-md transition-all group">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">📚</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Teaching & Study Mode</h2>
          <p className="text-center text-slate-500 text-sm px-4">
            Review detailed explanations, flashcards, and learn at your own pace without a timer.
          </p>
        </Link>

        {/* Notice the href is now a real route: "/exam" */}
        <Link href="/exam" className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-400 hover:shadow-md transition-all group">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">⏱️</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Mock Exam Mode</h2>
          <p className="text-center text-slate-500 text-sm px-4">
            Test your knowledge under real exam conditions with a strict timer and scoring.
          </p>
        </Link>
      </div>
    </main>
  );
}
