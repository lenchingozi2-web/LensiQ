import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { cookies } from 'next/headers';

// We add searchParams so we can read error messages from the URL
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard'); // Better to redirect to dashboard than root

  // Resolve the searchParams promise for Next.js 15
  const resolvedParams = await searchParams;

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
      const token = crypto.randomUUID();
      await supabaseServer.from('profiles').update({ session_token: token }).eq('id', data.user.id);
      
      const cookieStore = await cookies();
      cookieStore.set('session_token', token, { path: '/' });
      
      redirect('/dashboard');
    } else {
      // If login fails, redirect back to the page and attach the error to the URL
      redirect(`/signup?error=Invalid credentials. Please check your email and password.`);
    }
  }

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
      const token = crypto.randomUUID();
      await supabaseServer.from('profiles').update({ session_token: token }).eq('id', data.user.id);
      
      const cookieStore = await cookies();
      cookieStore.set('session_token', token, { path: '/' });
      
      redirect('/dashboard');
    } else {
      // Send the Supabase error message straight to the user
      redirect(`/signup?error=${error?.message || 'Error creating account.'}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-[#0B1220] tracking-tight mb-2">
            LenxiQ AI
          </h1>
          <p className="text-slate-500 text-sm">
            Sign in to access your medical command center.
          </p>
        </div>

        {/* ERROR DISPLAY: This red box will appear if an error is caught */}
        {resolvedParams?.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm text-center font-medium">
            {resolvedParams.error}
          </div>
        )}

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
          <div className="my-3 flex items-center gap-3 text-xs font-semibold text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>OR</span><span className="h-px flex-1 bg-slate-200" /></div>
          <a href="/auth/google?next=/dashboard" className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm hover:bg-slate-50">
            <span aria-hidden="true" className="text-base font-black">G</span>
            Continue with Google
          </a>
        </form>
      </div>
    </div>
  );
}
