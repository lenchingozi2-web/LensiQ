import { createClient } from '../lib/supabase/server';
import CbtEngine from '@/components/CbtEngine';

export default async function Home() {
  // 1. Secure server client to check who is logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Fetch the questions from the database so the engine has fuel!
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*');

  return (
    <main className="w-full flex flex-col items-center p-4">
      {/* Status bar showing the authenticated user */}
      <div className="w-full max-w-4xl flex justify-end mb-4">
        {user && (
          <span className="text-sm font-semibold bg-amber-100 text-amber-800 px-3 py-1 rounded-full shadow-sm">
            Logged in: {user.email}
          </span>
        )}
      </div>

      {/* Your custom Teaching & Quiz Mode interface */}
      <div className="w-full max-w-4xl">
        {error ? (
          <div className="bg-red-100 p-4 rounded text-red-700">
            <strong>Database Error:</strong> {error.message}
          </div>
        ) : (
          /* THIS IS THE FIX: We pass the questions and title to the engine */
          <CbtEngine 
            questions={questions || []} 
            testTitle="Medical Assessment" 
          />
        )}
      </div>
    </main>
  );
}
