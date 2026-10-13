import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type SearchParams = Promise<{ sent?: string; error?: string }>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const requestReset = async (formData: FormData) => {
    'use server';
    const email = String(formData.get('email') ?? '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) redirect('/forgot-password?error=Enter a valid email address.');

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lenxiq.online';
    const callbackUrl = new URL('/auth/callback', siteUrl);
    callbackUrl.searchParams.set('next', '/reset-password');
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: callbackUrl.toString() });
    if (error) redirect('/forgot-password?error=Password recovery could not be started. Please try again or use Google sign-in.');
    redirect('/forgot-password?sent=1');
  };

  return (
    <main className="flex min-h-[calc(100dvh-4.5rem)] w-full items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a5d00]">Account recovery</p>
        <h1 className="mt-3 text-3xl font-black text-[#0b1220]">Reset your password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Enter your account email and we’ll send a secure link. You can use this to set a password for an account that previously used Google sign-in.</p>
        {params.sent === '1' && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800">If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.</p>}
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800">{params.error}</p>}
        <form action={requestReset} className="mt-6 space-y-4">
          <label htmlFor="email" className="block text-sm font-bold text-slate-700">Email address</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-[#e8a23d]" />
          <button type="submit" className="w-full rounded-xl bg-[#0b1220] px-4 py-3 font-black text-white hover:bg-slate-800">Send secure reset link</button>
        </form>
        <Link href="/login" className="mt-5 inline-flex text-sm font-bold text-[#9a5d00] hover:underline">← Back to sign in</Link>
      </section>
    </main>
  );
}
