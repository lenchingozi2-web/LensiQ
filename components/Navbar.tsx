import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="w-full p-4 bg-slate-900 text-white flex justify-between items-center rounded-b-lg mb-6 shadow-md">
      <div className="font-bold text-xl">
        <Link href="/">Lensiq AI</Link>
      </div>
      <div className="flex gap-4 font-medium">
        <Link href="/pricing" className="hover:text-amber-400 transition-colors">Pricing</Link>
        <Link href="/signup" className="hover:text-amber-400 transition-colors">Sign Up</Link>
        <Link href="/admin" className="hover:text-amber-400 transition-colors text-slate-400">Admin</Link>
      </div>
    </nav>
  );
}
