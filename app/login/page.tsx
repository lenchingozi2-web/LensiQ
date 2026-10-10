import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { getOrCreateProfile } from '../../lib/profile';
import { issueActiveSession } from '../../lib/auth/active-session';

function safeNextPath(value: string | null | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  const login = async (formData: FormData) => {
    'use server'
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const nextPath = safeNextPath(formData.get('next') as string | null);
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      redirect(`/login?message=Could not authenticate user&next=${encodeURIComponent(nextPath)}`);
    }
    
    // Ensure an Auth user without a public profile is repaired before protected access.
    const { error: profileError } = await getOrCreateProfile(supabase, data.user);
    if (profileError) redirect('/login?message=Your account could not be initialized');
    const { error: activeSessionError } = await issueActiveSession(supabase, data.user.id);
    if (activeSessionError) redirect('/login?message=Your account session could not be secured');
    revalidatePath('/');
    redirect(nextPath);
  }

  const signup = async (formData: FormData) => {
    'use server'
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const nextPath = safeNextPath(formData.get('next') as string | null);
    const supabase = await createClient(); 

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      redirect(`/login?message=Could not sign up&next=${encodeURIComponent(nextPath)}`);
    }
    
    // Ensure an Auth user without a public profile is repaired before protected access.
    const { error: profileError } = await getOrCreateProfile(supabase, data.user);
    if (profileError) redirect('/login?message=Your account could not be initialized');
    const { error: activeSessionError } = await issueActiveSession(supabase, data.user.id);
    if (activeSessionError) redirect('/login?message=Your account session could not be secured');
    revalidatePath('/');
    redirect(nextPath);
  }

  return (
    <main className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto mt-20">
      <form className="flex-1 flex flex-col w-full justify-center gap-2 text-slate-800">
        <input type="hidden" name="next" value={next} />
        <h1 className="text-3xl font-bold mb-6 text-center text-[#0B1220]">LenxiQ AI access</h1>
        
        <label className="text-sm font-semibold" htmlFor="email">Email Address</label>
        <input 
          className="rounded-md px-4 py-2 bg-slate-50 border mb-4 text-slate-800" 
          name="email" 
          type="email"
          placeholder="doctor@example.com" 
          required 
        />
        
        <label className="text-sm font-semibold" htmlFor="password">Password</label>
        <input 
          className="rounded-md px-4 py-2 bg-slate-50 border mb-8 text-slate-800" 
          type="password" 
          name="password" 
          placeholder="••••••••" 
          required 
        />
        
        <button 
          formAction={login} 
          className="bg-[#0B1220] text-white rounded-md px-4 py-2 mb-2 font-semibold shadow hover:bg-slate-800"
        >
          Sign In
        </button>
        <button 
          formAction={signup} 
          className="border border-[#0B1220] text-[#0B1220] rounded-md px-4 py-2 mb-2 font-semibold hover:bg-slate-50"
        >
          Create Account
        </button>
        <div className="my-3 flex items-center gap-3 text-xs font-semibold text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>OR</span><span className="h-px flex-1 bg-slate-200" /></div>
        <a href={`/auth/google?next=${encodeURIComponent(next)}`} className="flex items-center justify-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
          <span aria-hidden="true" className="text-base font-black">G</span>
          Continue with Google
        </a>
      </form>
    </main>
  );
}
