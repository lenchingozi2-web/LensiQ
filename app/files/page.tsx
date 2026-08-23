'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Attachment = {
  id: string;
  conversation_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  extraction_status?: string | null;
  extraction_error?: string | null;
  created_at: string;
};

type FileResponse = { attachments: Attachment[]; storageUsedBytes: number; storageLimitBytes: number };

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const [data, setData] = useState<FileResponse>({ attachments: [], storageUsedBytes: 0, storageLimitBytes: 100 * 1024 * 1024 });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await fetch('/api/teaching/attachments', { cache: 'no-store' });
    if (!response.ok) {
      setError(response.status === 401 ? 'Please sign in to manage your retained lecture files.' : 'Unable to load your retained lecture files.');
      setLoading(false);
      return;
    }
    setData(await response.json());
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void loadFiles(); }, 0); return () => window.clearTimeout(timer); }, [loadFiles]);

  const deleteFile = async (attachment: Attachment) => {
    const confirmed = window.confirm(`Permanently delete “${attachment.file_name}”? This removes the stored file and its Teaching record and cannot be undone.`);
    if (!confirmed) return;
    setDeletingId(attachment.id);
    setError('');
    setNotice('');
    const response = await fetch(`/api/teaching/attachments/${attachment.id}`, { method: 'DELETE' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'The file could not be permanently deleted.');
      setDeletingId(null);
      return;
    }
    setData((current) => ({ ...current, attachments: current.attachments.filter((item) => item.id !== attachment.id), storageUsedBytes: Math.max(0, current.storageUsedBytes - attachment.size_bytes) }));
    setNotice(`${attachment.file_name} was permanently deleted.`);
    setDeletingId(null);
  };

  const percent = useMemo(() => Math.min(100, Math.round((data.storageUsedBytes / Math.max(data.storageLimitBytes, 1)) * 100)), [data]);
  const remaining = Math.max(0, data.storageLimitBytes - data.storageUsedBytes);

  return <main className="min-h-screen bg-[#f6f7fb] px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><Link href="/teach" className="text-sm font-black text-slate-500 hover:text-[#0B1220]">← Back to Teaching Room</Link><header className="mt-6 rounded-[2rem] bg-[#0B1220] p-7 text-white shadow-xl sm:p-9"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#E8A23D]">Personal file management</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Your retained lecture files</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">Review and permanently delete lecture files retained for your Teaching Room. Deletion removes the Supabase storage object and its database record.</p></div><Link href="/teach" className="rounded-xl bg-[#E8A23D] px-4 py-3 text-center text-sm font-black text-[#0B1220] hover:bg-amber-400">Upload from Teaching</Link></div></header><section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Storage usage</p><p className="mt-2 text-2xl font-black text-[#0B1220]">{formatBytes(data.storageUsedBytes)} <span className="text-base font-bold text-slate-400">/ {formatBytes(data.storageLimitBytes)}</span></p></div><div className="text-right text-xs font-bold text-slate-500"><p>{percent}% used</p><p className="mt-1">{formatBytes(remaining)} remaining</p></div></div><div className="mt-4 h-3 rounded-full bg-slate-100"><div className={`h-3 rounded-full ${percent >= 90 ? 'bg-red-500' : percent >= 75 ? 'bg-amber-500' : 'bg-[#E8A23D]'}`} style={{ width: `${percent}%` }} /></div><p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Each lecture file is limited to 20 MB. Persistent Teaching storage is limited to 100 MB per user. Temporary search uploads are not counted here.</p></section>{error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div>}{notice && <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{notice}</div>}<section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4"><div><h2 className="text-lg font-black text-[#0B1220]">Retained Teaching files</h2><p className="mt-1 text-xs font-semibold text-slate-500">{data.attachments.length} file{data.attachments.length === 1 ? '' : 's'} stored</p></div><button type="button" onClick={() => void loadFiles()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100">Refresh</button></div>{loading ? <p className="p-10 text-center text-sm font-semibold text-slate-500">Loading your retained files…</p> : data.attachments.length === 0 ? <div className="p-10 text-center"><p className="text-lg font-black text-slate-700">No retained lecture files</p><p className="mt-2 text-sm leading-6 text-slate-500">Upload a PDF, PPTX, DOCX, or TXT file in Teaching Room when you want the tutor to use it.</p><Link href="/teach" className="mt-5 inline-block rounded-xl bg-[#0B1220] px-4 py-3 text-sm font-black text-white">Open Teaching Room</Link></div> : <ul className="divide-y divide-slate-100">{data.attachments.map((attachment) => <li key={attachment.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{attachment.file_name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{formatBytes(attachment.size_bytes)} · {new Date(attachment.created_at).toLocaleDateString()} · {attachment.extraction_status === 'complete' ? 'Ready for teaching' : attachment.extraction_status === 'failed' ? 'Extraction failed' : 'Processing'}</p>{attachment.extraction_error && <p className="mt-1 text-xs font-semibold text-red-600">{attachment.extraction_error}</p>}</div><button type="button" onClick={() => void deleteFile(attachment)} disabled={deletingId === attachment.id} className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 hover:bg-red-100 disabled:cursor-wait disabled:opacity-60">{deletingId === attachment.id ? 'Deleting permanently…' : 'Delete permanently'}</button></li>)}</ul>}</section></div></main>;
}
