import Link from 'next/link';

export default function Home() {
  return (
    <main className="w-full max-w-4xl mx-auto flex flex-col items-center p-4">
      
      {/* The Sleek Branding Banner */}
      <div className="w-full py-6 md:py-8 mb-4 text-center cursor-default flex flex-col items-center">
        {/* Your Lensiq Brand Board (Updated to icon.png and made wide) */}
        <img 
          src="/icon.png" 
          alt="Lensiq Brand Identity" 
          className="w-full max-w-2xl mb-6 rounded-xl shadow-md object-cover" 
        />
        
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-3 tracking-tight">
          Welcome to Lensiq AI
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium">
          Select a module below to begin your session.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Card 1: AI Teaching Mode */}
        <Link href="/teach" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-purple-400 transition-all group">
          <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">🤖</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">AI Teaching Mode</h2>
          <p className="text-center text-slate-500 text-xs px-2">Chat with your AI smart tutor for deep explanations.</p>
        </Link>

        {/* Card 2: Study Mode */}
        <Link href="/study" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-amber-400 transition-all group">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">📚</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Study Mode</h2>
          <p className="text-center text-slate-500 text-xs px-2">Review flashcards and learn at your own pace.</p>
        </Link>

        {/* Card 3: Mock Exam Mode */}
        <Link href="/exam" className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-400 transition-all group">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">⏱️</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Mock Exam</h2>
          <p className="text-center text-slate-500 text-xs px-2">Test your knowledge under real exam conditions.</p>
        </Link>
      </div>
    </main>
  );
}
