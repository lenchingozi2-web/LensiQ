'use client';

import { useCallback, useRef, useState } from 'react';

const MAX_FILES = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

type SlideBatchUploaderProps = {
  onFilesChange?: (files: File[]) => void;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export default function SlideBatchUploader({ onFilesChange }: SlideBatchUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const updateFiles = useCallback((nextFiles: File[]) => {
    setFiles(nextFiles);
    onFilesChange?.(nextFiles);
  }, [onFilesChange]);

  const addFiles = useCallback((incoming: File[]) => {
    setErrors([]);
    const nextErrors: string[] = [];
    const accepted: File[] = [];
    const existingKeys = new Set(files.map((file) => `${file.name}:${file.size}:${file.lastModified}`));

    for (const file of incoming) {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (!isPdf(file)) {
        nextErrors.push(`${file.name}: only PDF files are supported.`);
      } else if (file.size === 0) {
        nextErrors.push(`${file.name}: the file is empty.`);
      } else if (file.size > MAX_FILE_SIZE) {
        nextErrors.push(`${file.name}: exceeds the 20 MB per-file limit.`);
      } else if (existingKeys.has(key)) {
        nextErrors.push(`${file.name}: already added.`);
      } else if (files.length + accepted.length >= MAX_FILES) {
        nextErrors.push(`You can add up to ${MAX_FILES} PDF files per batch.`);
      } else {
        accepted.push(file);
        existingKeys.add(key);
      }
    }

    if (accepted.length > 0) updateFiles([...files, ...accepted]);
    setErrors(nextErrors);
  }, [files, updateFiles]);

  const removeFile = (index: number) => {
    updateFiles(files.filter((_, fileIndex) => fileIndex !== index));
  };

  const clearFiles = () => {
    updateFiles([]);
    setErrors([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.07)] sm:p-7" aria-labelledby="slide-upload-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9A5D00]">Lecture library</p>
          <h2 id="slide-upload-title" className="mt-2 text-2xl font-black tracking-tight text-[#0B1220]">Add a slide batch</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Upload up to 20 PDF lecture decks together. We will parse each deck into searchable slide content for Studio sessions and past-question mapping.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#FFF8E9] px-3 py-1.5 text-xs font-black text-[#8B5709]">{files.length} / {MAX_FILES} files</span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}
        className={`mt-6 flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${isDragging ? 'border-[#E8A23D] bg-[#FFF8E9]' : 'border-slate-300 bg-slate-50 hover:border-[#E8A23D] hover:bg-[#FFFDF7]'}`}
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B1220] text-2xl text-[#E8A23D]" aria-hidden="true">↑</span>
        <span className="mt-4 text-sm font-black text-[#0B1220]">{isDragging ? 'Drop your PDFs here' : 'Drag and drop PDF lecture decks'}</span>
        <span className="mt-2 text-xs font-semibold text-slate-500">or click to browse · maximum 20 files · 20 MB per file</span>
      </button>

      {errors.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800">
          <p className="font-black">Some files were not added</p>
          <ul className="mt-1 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Queued for processing</p>
            <button type="button" onClick={clearFiles} className="text-xs font-black text-slate-500 hover:text-red-700">Clear batch</button>
          </div>
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
            {files.map((file, index) => (
              <li key={`${file.name}:${file.lastModified}`} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[10px] font-black text-red-700">PDF</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">{file.name}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-400">{formatBytes(file.size)}</span>
                </span>
                <button type="button" onClick={() => removeFile(index)} className="rounded-lg px-2 py-1.5 text-xs font-black text-slate-400 hover:bg-red-50 hover:text-red-700" aria-label={`Remove ${file.name}`}>Remove</button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            <span className="text-base" aria-hidden="true">✓</span>
            <span>Batch ready. Document parsing and question mapping will begin when the Library processing service is connected.</span>
          </div>
        </div>
      )}
    </section>
  );
}
