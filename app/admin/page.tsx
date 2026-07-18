import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/server';

export default async function AdminDashboard() {
  const supabase = await createClient();
  
  // 1. Secure the route
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signup');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/'); 

  // 2. Fetch Master Settings
  const { data: settings } = await supabase
    .from('site_settings')
    .select('is_ai_tutor_enabled, is_practical_launched')
    .eq('id', 1)
    .single();
    
  const isAITutorEnabled = settings?.is_ai_tutor_enabled ?? false;
  const isPracticalLaunched = settings?.is_practical_launched ?? false;

  // 3. Server Actions for Toggles
  async function toggleAITutor() {
    "use server";
    const supabaseServer = await createClient();
    await supabaseServer.from('site_settings').update({ is_ai_tutor_enabled: !isAITutorEnabled }).eq('id', 1);
    revalidatePath('/admin');
  }

  async function togglePracticals() {
    "use server";
    const supabaseServer = await createClient();
    await supabaseServer.from('site_settings').update({ is_practical_launched: !isPracticalLaunched }).eq('id', 1);
    revalidatePath('/admin');
    revalidatePath('/pricing'); // Instantly update the pricing page too
  }

  // 4. Fetch Cache and Flags
  const { count: cacheCount } = await supabase.from('question_explanations').select('*', { count: 'exact', head: true });
  const { data: flaggedQuestions } = await supabase
    .from('answer_flags')
    .select('id, flag_reason, status, created_at, questions ( text )')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900">Admin Command Center</h1>
        <p className="text-slate-500 mt-2">Manage AI settings, content launches, and flagged curriculum.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        {/* AI Tutor Toggle */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✨</span>
              <h2 className="text-lg font-bold text-slate-800">AI Tutor Status</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">Enable/disable the global AI engine.</p>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="font-semibold text-slate-700">{isAITutorEnabled ? 'Live / Active' : 'Locked'}</span>
            <form action={toggleAITutor}>
              <button type="submit" className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${isAITutorEnabled ? 'bg-green-500' : 'bg-slate-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isAITutorEnabled ? 'translate-x-8' : 'translate-x-1'}`} />
              </button>
            </form>
          </div>
        </div>

        {/* Practicals Launch Toggle */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🔬</span>
              <h2 className="text-lg font-bold text-slate-800">Practicals Status</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">Unlock the 12-Month tier on the pricing page.</p>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="font-semibold text-slate-700">{isPracticalLaunched ? 'Launched' : 'Locked'}</span>
            <form action={togglePracticals}>
              <button type="submit" className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${isPracticalLaunched ? 'bg-[#E8A23D]' : 'bg-slate-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isPracticalLaunched ? 'translate-x-8' : 'translate-x-1'}`} />
              </button>
            </form>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1 md:col-span-2">
          <h2 className="text-lg font-bold text-slate-800 mb-4">System Health</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
              <p className="text-xs text-red-600 font-semibold mb-1">Flagged</p>
              <p className="text-2xl font-extrabold text-red-900">{flaggedQuestions?.length || 0}</p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs text-indigo-600 font-semibold mb-1">Cached AI</p>
              <p className="text-2xl font-extrabold text-indigo-900">{cacheCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Flag Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">⚠️ Flagged Content Queue</h2>
        </div>
        <div className="p-0">
          {!flaggedQuestions || flaggedQuestions.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <span className="text-4xl block mb-3">✅</span>
              <p className="font-medium">All clear! No questions currently flagged.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {flaggedQuestions.map((flag) => (
                <li key={flag.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-slate-900 font-medium line-clamp-2">
                      <span className="text-slate-500 mr-2">Q:</span>{(flag.questions as any)?.text || "Unknown"}
                    </p>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-red-800">
                      <strong>AI Note:</strong> {flag.flag_reason}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
