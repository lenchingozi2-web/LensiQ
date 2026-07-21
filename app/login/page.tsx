import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { cookies } from 'next/headers';

export default function LoginPage() {
  const login = async (formData: FormData) => {
    'use server'
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      redirect('/login?message=Could not authenticate user');
    }
    
    // FIXED SECURITY LOGIC: Await cookies properly
    const token = crypto.randomUUID();
    await supabase.from('profiles').update({ session_token: token }).eq('id', data.user.id);
    const cookieStore = await cookies();
    cookieStore.set('session_token', token, { path: '/' });
    
    revalidatePath('/');
    redirect('/');
  }

  const signup = async (formData: FormData) => {
    'use server'
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient(); 

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      redirect('/login?message=Could not sign up');
    }
    
    // FIXED SECURITY LOGIC: Await cookies properly
    const token = crypto.randomUUID();
    await supabase.from('profiles').update({ session_token: token }).eq('id', data.user.id);
    const cookieStore = await cookies();
    cookieStore.set('session_token', token, { path: '/' });
    
    revalidatePath('/');
    redirect('/');
  }

  return (
    <main className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto mt-20">
      <form className="flex-1 flex flex-col w-full justify-center gap-2 text-slate-800">
        <h1 className="text-3xl font-bold mb-6 text-center text-[#0B1220]">Lensiq Access</h1>
        
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
      </form>
    </main>
  );
}
