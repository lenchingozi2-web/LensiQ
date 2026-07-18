import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

export default async function AuthPage() {
  // If they are already logged in, send them to the dashboard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  // The Server Action that securely processes the form
  async function handleAuth(formData: FormData) {
    "use server";
    
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const action = formData.get('action') as string;
    
    const supabaseServer = await createClient();
    
    if (action === 'signup') {
      const { error } = await supabaseServer.auth.signUp({ email, password });
      if (error) console.error("Signup error:", error.message);
    } else {
      const { error } = await supabaseServer.auth.signInWithPassword({ email, password });
      if (error) console.error("Login error:", error.message);
    }
    
    // Redirect to the pricing page so they can finish upgrading!
    redirect('/pricing');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#0B1220] tracking-tight mb-2">
            Lensiq<span className="text-[#E8A23D]">AI</span>
          </h1>
          <p className="text-slate-500 text-sm">Sign in to access your medical command center.</p>
        </div>

        <form action={handleAuth} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              name="email" 
              required 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#E8A23D] focus:ring-2 focus:ring-[#E8A23D]/20 outline-none transition-all"
              placeholder="doctor@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              name="password" 
              required 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#E8A23D] focus:ring-2 focus:ring-[#E8A23D]/20 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="submit" 
              name="action" 
              value="login" 
              className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 font-bold hover:bg-slate-800 transition-colors"
            >
              Log In
            </button>
            <button 
              type="submit" 
              name="action" 
              value="signup" 
              className="w-full bg-[#E8A23D] text-slate-900 rounded-xl px-4 py-3 font-bold hover:bg-amber-500 transition-colors"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
