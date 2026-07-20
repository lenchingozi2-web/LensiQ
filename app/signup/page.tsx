import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { cookies } from 'next/headers';

export default async function AuthPage() {
  // If they are already logged in, send them to the homepage
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/');

  // Action specifically for Logging In
  async function handleLogin(formData: FormData) {
    "use server";
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabaseServer = await createClient();

    const { data, error } = await supabaseServer.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      // SECURITY LOGIC: Generate token, save to DB, and set as browser cookie
      const token = crypto.randomUUID();
      await supabaseServer.from('profiles').update({ session_token: token }).eq('id', data.user.id);
      
      // @ts-ignore: Next.js types incorrectly mark cookies as read-only here, but it works at runtime in Server Actions
      cookies().set('session_token', token, { path: '/' });
      
      redirect('/');
    } else {
      console.error("Login error:", error?.message);
    }
  }

  // Action specifically for Creating an Account
  async function handleSignup(formData: FormData) {
    "use server";
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabaseServer = await createClient();

    const { data, error } = await supabaseServer.auth.signUp({
      email,
      password,
    });

    if (!error && data.user) {
      // SECURITY LOGIC: Generate token, save to DB, and set as browser cookie
      const token = crypto.randomUUID();
      await supabaseServer.from('profiles').update({ session_token: token }).eq('id', data.user.id);
      
      // @ts-ignore: Next.js types incorrectly mark cookies as read-only here, but it works at runtime in Server Actions
      cookies().set('session_token', token, { path: '/' });
      
      redirect('/');
    } else {
      console.error("Signup error:", error?.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#0B1220] tracking-tight mb-2">
            LenxiQ<span className="text-[#E8A23D]">AI</span>
          </h1>
          <p className="text-slate-500 text-sm">
            Sign in to access your medical command center.
          </p>
        </div>

        <form className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#E8A23D] focus:ring-2 focus:ring-[#E8A23D]/20 outline-none transition-all"
              placeholder="doctor@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
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
              formAction={handleLogin}
              className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 font-bold hover:bg-slate-800 transition-colors"
            >
              Log In
            </button>

            <button
              formAction={handleSignup}
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
