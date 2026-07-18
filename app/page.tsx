import { createClient } from '../lib/supabase/server';

export default async function Home() {
  // 1. Use the new secure server client instead of the basic one
  const supabase = await createClient();

  // 2. Grab the logged-in user to prove the cookie works
  const { data: { user } } = await supabase.auth.getUser();

  // 3. Fetch the questions (RLS will now allow this because we are authenticated!)
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .limit(5);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#0B1220]">Lensiq AI</h1>
        {user && (
          <span className="text-sm font-semibold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
            Logged in: {user.email}
          </span>
        )}
      </div>
      
      {error ? (
        <div className="bg-red-100 p-4 rounded text-red-700">
          <strong>Database Error:</strong> {error.message}
        </div>
      ) : (
        <div className="space-y-4">
          {questions && questions.length > 0 ? (
             questions.map((q, i) => (
               <div key={i} className="border p-4 rounded-lg shadow-sm bg-white lens-focus">
                 <p className="text-sm font-bold text-[#E8A23D] mb-2">
                   {q.type?.toUpperCase()} Question
                 </p>
                 <p className="text-lg text-slate-700 mb-3">{q.stem || q.question_text}</p>
               </div>
             ))
          ) : (
             <div className="bg-yellow-50 p-4 border border-yellow-200 rounded text-yellow-800">
               <p className="font-bold mb-1">Still returning 0 questions.</p>
               <p className="text-sm">
                 If you see your email in the top right, RLS is unlocked! If this is still showing 0, it means your Supabase 'questions' table might literally be empty.
               </p>
             </div>
          )}
        </div>
      )}
    </main>
  );
}
