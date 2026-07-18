import { createClient } from '../lib/supabase/server';
import CbtEngine from '@/components/CbtEngine';

export default async function Home() {
  // Secure server client to check who is logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="w-full flex flex-col items-center">
      {/* Status bar showing the authenticated user */}
      <div className="w-full flex justify-end mb-4">
        {user && (
          <span className="text-sm font-semibold bg-amber-100 text-amber-800 px-3 py-1 rounded-full shadow-sm">
            Logged in: {user.email}
          </span>
        )}
      </div>

      {/* Your custom Teaching & Quiz Mode interface */}
      <div className="w-full">
        <CbtEngine />
      </div>
    </main>
  );
}
