import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type SearchParams = Promise<{ error?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const updatePassword = async (formData: FormData) => {
    'use server';
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    if (password.length < 8) redirect('/reset-password?error=Use a password with at least 8 characters.');
    if (password !== confirmPassword) redirect('/reset-password?error=The passwords do not match.');

    const serverClient = await createClient();
    const { data: { user: recoveryUser } } = await serverClient.auth.getUser();
    if (!recoveryUser) redirect('/forgot-password?error=Open the latest reset link from your email, then try again.');
    const { error } = await serverClient.auth.updateUser({ password });
    if (error) redirect('/reset-password?error=Password could not be updated. Request a fresh reset link and try again.');
    redirect('/dashboard?password=updated');
  };

  return (
    <main className="flex min-h-[calc(100dvh-4.5rem)] w-full items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a5d00]">Account recovery</p>
        <h1 className="mt-3 text-3xl font-black text-[#0b1220]">Choose a new password</h1>
        {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800">{params.error}</p>}
        {user ? (
          <form action={updatePassword} className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-slate-600">Set a password for this LenxiQ AI account. Your existing account role and study data will remain unchanged.</p>
            <label htmlFor="password" className="block text-sm font-bold text-slate-700">New password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-[#e8a23d]" />
            <label htmlFor="confirmPassword" className="block text-sm font-bold text-slate-700">Confirm new password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-[#e8a23d]" />
            <button type="submit" className="w-full rounded-xl bg-[#0b1220] px-4 py-3 font-black text-white hover:bg-slate-800">Update password</button>
          </form>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Open the latest password-reset link from your email to set a new password. <Link href="/forgot-password" className="font-black underline">Request another link</Link>.</div>
        )}
        <Link href="/login" className="mt-5 inline-flex text-sm font-bold text-[#9a5d00] hover:underline">← Back to sign in</Link>
      </section>
    </main>
  );
}
