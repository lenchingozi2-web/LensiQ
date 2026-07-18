import { createClient } from '../../lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // 1. Authenticate the user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  // If they aren't logged in, kick them back to the login page
  if (authError || !user) {
    redirect('/login');
  }

  // 2. Fetch all of their past mock exams, newest first
  const { data: results, error: resultsError } = await supabase
    .from('exam_results')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // 3. Calculate their overall statistics
  const totalExams = results?.length || 0;
  const averagePercentage = totalExams > 0 
    ? Math.round(results!.reduce((acc, curr) => acc + curr.percentage, 0) / totalExams)
    : 0;

  // Formatting the date nicely
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <main className="p-4 sm:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto mt-6">
        
        {/* Header Section */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0B1220] mb-2">
            Welcome back, <span className="text-[#E8A23D]">Doctor.</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg">Here is an overview of your recent performance.</p>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
            <div className="bg-indigo-50 w-16 h-16 rounded-xl flex items-center justify-center text-indigo-500 text-2xl font-black">
              📝
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-sm mb-1">Total Exams</p>
              <p className="text-4xl font-black text-[#0B1220]">{totalExams}</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6">
            <div className="bg-amber-50 w-16 h-16 rounded-xl flex items-center justify-center text-[#E8A23D] text-2xl font-black">
              🎯
            </div>
            <div>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-sm mb-1">Average Score</p>
              <p className="text-4xl font-black text-[#0B1220]">{averagePercentage}%</p>
            </div>
          </div>
        </div>

        {/* Quick Action */}
        <div className="mb-12">
          <Link href="/browse" className="bg-[#0B1220] text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md inline-block">
            Take a New Mock Exam &rarr;
          </Link>
        </div>

        {/* Recent Exams History Table */}
        <div>
          <h2 className="text-2xl font-bold text-[#0B1220] mb-6">Recent Mock Exams</h2>
          
          {totalExams === 0 ? (
            <div className="bg-white p-10 text-center rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-4xl mb-4 block">📭</span>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No exams taken yet</h3>
              <p className="text-slate-500">Your test history will appear here once you complete a mock exam.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm uppercase tracking-wider">
                      <th className="p-4 sm:p-6 font-bold">Exam Title</th>
                      <th className="p-4 sm:p-6 font-bold">Score</th>
                      <th className="p-4 sm:p-6 font-bold">Percentage</th>
                      <th className="p-4 sm:p-6 font-bold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results?.map((result) => (
                      <tr key={result.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 sm:p-6 font-bold text-slate-800">
                          {result.test_title}
                        </td>
                        <td className="p-4 sm:p-6 text-slate-600 font-medium">
                          {result.score} / {result.total_questions}
                        </td>
                        <td className="p-4 sm:p-6">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                            result.percentage >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {result.percentage}%
                          </span>
                        </td>
                        <td className="p-4 sm:p-6 text-slate-400 text-sm text-right whitespace-nowrap">
                          {formatDate(result.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
