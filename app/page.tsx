import Link from 'next/link';

export default function Home() {
  return (
    <main className="w-full max-w-5xl mx-auto flex flex-col items-center p-4">

      {/* Branding */}
      <div className="w-full py-6 md:py-8 mb-4 text-center flex flex-col items-center">
        <img
          src="/icon.png"
          alt="LensiQ Brand Identity"
          className="w-full max-w-2xl mb-6 rounded-xl shadow-md object-cover"
        />

        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-3 tracking-tight">
          Welcome to LensiQ AI
        </h1>

        <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium">
          Select a module below to begin your session.
        </p>
      </div>

      {/* Premium Button */}
      <div className="flex justify-center w-full mb-8">
        <Link
          href="/pricing"
          className="px-8 py-3 rounded-xl bg-[#E8A23D] text-slate-900 font-bold shadow hover:bg-amber-500 transition-all"
        >
          View Premium Plans
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">

        {/* AI Teaching */}
        <Link
          href="/teach"
          className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border-2 border-slate-100 hover:border-purple-400 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
        >
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-3xl">🤖</span>
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2">
            AI Teaching Mode
          </h2>

          <p className="text-center text-slate-500 text-sm">
            Chat with your AI tutor for deep explanations.
          </p>
        </Link>

        {/* Browse Questions */}
        <Link
          href="/browse"
          className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border-2 border-slate-100 hover:border-amber-400 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
        >
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-3xl">📚</span>
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Browse Questions
          </h2>

          <p className="text-center text-slate-500 text-sm">
            Browse medical questions by subject and division.
          </p>
        </Link>

        {/* Mock Exam */}
        <Link
          href="/exam"
          className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border-2 border-slate-100 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-3xl">⏱️</span>
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Mock Exam
          </h2>

          <p className="text-center text-slate-500 text-sm">
            Test your knowledge under real exam conditions.
          </p>
        </Link>

      </div>
    </main>
  );
}