import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { checkAccess } from '@/lib/gatekeeper';
export default async function SubjectPage({params}:{params:Promise<{subject:string}>}) {
 const {subject}=await params;
 const title=subject.split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
 const access=await checkAccess('browse',title);
 if(!access.allowed) return <main className="p-10 text-center">{access.message}<Link href="/pricing">View plans</Link></main>;
 const db=await createClient();
 const {data,error}=await db.from('questions').select('division,type').ilike('subject',title).limit(5000);
 const divisions=Array.from(new Set((data??[]).map(q=>q.division as string).filter(Boolean))).sort();
 return <main className="mx-auto max-w-6xl p-6"><Link href="/browse">← Courses</Link><h1 className="my-6 text-4xl font-black">{title}</h1><p className="mb-8 text-slate-600">Free includes a starter branch in each course and format. Paid plans open the complete bank. Your available branches are shown below.</p>{error&&<p role="alert">Unable to load branches.</p>}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{divisions.map(d=><Link key={d} href={`/browse/${subject}/${encodeURIComponent(d)}`} className="rounded-2xl border bg-white p-6 font-bold shadow-sm">{d} →</Link>)}</div><Link className="mt-8 inline-block font-bold text-amber-700" href="/pricing">Compare plans</Link></main>;
}
