import { createClient } from '../../../../../lib/supabase/server';
import { checkAccess } from '../../../../../lib/gatekeeper';
import { ANATOMICAL_PATHOLOGY_SYSTEMS, isAnatomicalPathologyAggregate } from '../../../../../lib/practical-catalogue';
import StudyCard from '../../../../../components/StudyCard';
import Link from 'next/link';

function titleFromSlug(value: string) {
  return value.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export default async function BrowseModePage({ params }: { params: Promise<{ subject: string, division: string, type: string }> }) {
  const supabase = await createClient();
  const resolvedParams = await params;
  const subjectId = resolvedParams.subject;
  const rawDivision = decodeURIComponent(resolvedParams.division);
  const questionType = resolvedParams.type.toLowerCase();
  const subjectTitle = titleFromSlug(subjectId);
  const isAnatomicalAggregate = isAnatomicalPathologyAggregate(subjectId, rawDivision);
  const isAnatomicalSystem = subjectId === 'pathology' && ANATOMICAL_PATHOLOGY_SYSTEMS.includes(rawDivision as typeof ANATOMICAL_PATHOLOGY_SYSTEMS[number]);
  const displayDivision = isAnatomicalAggregate ? 'Anatomical Pathology practicals' : (rawDivision.includes('-') ? titleFromSlug(rawDivision) : rawDivision);
  const canonicalDivision = isAnatomicalAggregate ? 'Anatomical Pathology' : rawDivision;

  if (questionType === 'practical') {
    const practicalAccess = await checkAccess('practical', undefined, isAnatomicalAggregate ? undefined : rawDivision);
    if (!practicalAccess.allowed) {
      const selectedSystemHref = practicalAccess.freePracticalBranch ? `/browse/${subjectId}/${encodeURIComponent(practicalAccess.freePracticalBranch)}/practical` : `/browse/${subjectId}`;
      const canChooseSystem = isAnatomicalAggregate || isAnatomicalSystem;
      return <main className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB] px-4 py-12 text-center sm:px-6"><div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-8 shadow-xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#9A5D00]">Practical access</p><h1 className="mt-3 text-3xl font-black text-[#0B1220]">Choose your free practical system</h1><p className="mt-4 leading-7 text-slate-600">{practicalAccess.message}</p>{canChooseSystem && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left"><p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">One free choice per account</p><p className="mt-1 text-sm font-bold leading-6 text-emerald-900">Choose one Anatomical Pathology organ/system from the catalogue. That system becomes your free practical access; the other systems require a subscription.</p></div>}<div className="mt-7 flex flex-wrap justify-center gap-3">{canChooseSystem && <Link href={selectedSystemHref} className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white hover:bg-emerald-700">{practicalAccess.needsFreePracticalSelection ? 'Choose a free system' : 'Open your free practical'}</Link>}<Link href="/pricing" className="rounded-xl bg-[#E8A23D] px-6 py-3 font-black text-[#0B1220] hover:bg-amber-500">View subscription plans</Link><Link href="/browse" className="rounded-xl border border-slate-200 px-6 py-3 font-bold text-slate-700">Back to practice</Link></div></div></main>;
    }
  }

  let query = supabase.from('questions').select('*').ilike('subject', subjectTitle).eq('type', questionType);
  query = isAnatomicalAggregate ? query.in('division', [...ANATOMICAL_PATHOLOGY_SYSTEMS]) : query.eq('division', rawDivision);
  const { data: questions, error } = await query.order('created_at', { ascending: true });

  if (error || !questions || questions.length === 0) return <main className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB] px-4 py-12 text-center sm:px-6"><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Practice bank</p><h1 className="mt-3 text-3xl font-black text-[#0B1220]">No {questionType.toUpperCase()} questions found</h1><p className="mt-4 leading-7 text-slate-600">There are no stored {questionType} questions for {displayDivision} yet. Try another format or return to the division menu.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href={`/browse/${subjectId}/${encodeURIComponent(canonicalDivision)}`} className="rounded-xl bg-[#0B1220] px-6 py-3 font-black text-white">Back to formats</Link><Link href="/search" className="rounded-xl border border-slate-200 px-6 py-3 font-bold text-slate-700">Search question bank</Link></div></div></main>;

  return <main className="min-h-[calc(100vh-4.5rem)] bg-[#F6F8FB] px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><div className="mx-auto max-w-5xl"><div className="mb-8 flex flex-wrap items-center justify-between gap-3"><div><Link href={`/browse/${subjectId}/${encodeURIComponent(canonicalDivision)}`} className="text-sm font-black text-slate-500 hover:text-[#9A5D00]">← Back to formats</Link><p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[#9A5D00]">{subjectTitle} · {questionType}</p><h1 className="mt-2 text-4xl font-black tracking-[-0.04em] text-[#0B1220] sm:text-5xl">{displayDivision}</h1><p className="mt-3 text-base leading-7 text-slate-600">{questions.length} preserved question{questions.length === 1 ? '' : 's'} in this study set.</p></div><div className="flex gap-2"><Link href="/curriculum" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Study path</Link><Link href="/voice" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Voice Tutor</Link></div></div><div className="space-y-6">{questions.map((question, index) => <StudyCard key={question.id} question={question} index={index} />)}</div></div></main>;
}
