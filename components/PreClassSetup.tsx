'use client';

import { useRef, useState } from 'react';
import type { DragEvent } from 'react';

const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt'];
const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

type PreClassSetupProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onUploadedFileUrlsChange?: (urls: string[]) => void;
  focusText: string;
  onFocusTextChange: (value: string) => void;
};

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(bytes === 0 ? 0 : 1)} MB`;
}

function isAcceptedFile(file: File) {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return ACCEPTED_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.includes(extension);
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export default function PreClassSetup({
  files,
  onFilesChange,
  onUploadedFileUrlsChange,
  focusText,
  onFocusTextChange,
}: PreClassSetupProps) {
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedUrlsRef = useRef(new Map<string, string>());
  const uploadFolderRef = useRef<string | null>(null);
  const totalBytes = files.reduce((total, file) => total + file.size, 0);

  const publishUploadedUrls = () => {
    const urls = Array.from(uploadedUrlsRef.current.values());
    onUploadedFileUrlsChange?.(urls);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lensiq:uploaded-materials', { detail: urls }));
  };

  const addFiles = async (incomingFiles: File[]) => {
    setError('');
    const invalidFiles = incomingFiles.filter((file) => !isAcceptedFile(file));
    const validFiles = incomingFiles.filter(isAcceptedFile);

    if (invalidFiles.length > 0) {
      setError(`Unsupported file${invalidFiles.length === 1 ? '' : 's'}: ${invalidFiles.map((file) => file.name).join(', ')}. Use PDF, DOCX, PPTX, or TXT.`);
    }
    if (validFiles.length === 0) return;

    const existingKeys = new Set(files.map(fileKey));
    const newFiles = validFiles.filter((file) => !existingKeys.has(fileKey(file)));
    const nextCount = files.length + newFiles.length;
    const nextBytes = totalBytes + newFiles.reduce((total, file) => total + file.size, 0);

    if (nextCount > MAX_FILES) {
      setError(`Files not added. A Live Class supports up to ${MAX_FILES} files total.`);
      return;
    }
    if (nextBytes > MAX_TOTAL_BYTES) {
      setError(`Files not added. The combined file size cannot exceed 50 MB (this would use ${formatMegabytes(nextBytes)}).`);
      return;
    }

    if (newFiles.length === 0) return;

    setUploadProgress(0);
    const uploadedFiles: File[] = [];
    try {
      if (typeof window === 'undefined') throw new Error('File uploads are only available in the browser.');
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const uploadFolder = uploadFolderRef.current ?? `class_${Date.now()}_${window.crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
      uploadFolderRef.current = uploadFolder;

      for (const [index, file] of newFiles.entries()) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${uploadFolder}/${safeName}`;
        const { error: uploadError } = await supabase.storage.from('ephemeral_class_materials').upload(filePath, file);
        if (uploadError) throw new Error(`Unable to upload ${file.name}: ${uploadError.message}`);
        const { data } = supabase.storage.from('ephemeral_class_materials').getPublicUrl(filePath);
        uploadedUrlsRef.current.set(fileKey(file), data.publicUrl);
        uploadedFiles.push(file);
        setUploadProgress(Math.round(((index + 1) / newFiles.length) * 100));
      }

      onFilesChange([...files, ...uploadedFiles]);
      publishUploadedUrls();
    } catch (uploadError) {
      onFilesChange([...files, ...uploadedFiles]);
      publishUploadedUrls();
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload the selected files.');
    } finally {
      setUploadProgress(null);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <section className="w-full rounded-2xl border border-[#E4DFD4] bg-[#F8F6F0] px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9A5D00]">Pre-Class Setup</p>
          <h2 className="mt-1 text-base font-black text-[#27231D] sm:text-lg">Bring your study material</h2>
        </div>
        <p className="w-full text-xs font-black text-[#8B8578] sm:w-auto">{files.length}/{MAX_FILES} files · {formatMegabytes(totalBytes)} / 50 MB used</p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => { if (uploadProgress === null) inputRef.current?.click(); }}
        onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && uploadProgress === null) { event.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`mt-4 flex min-h-28 w-full items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${uploadProgress !== null ? 'cursor-wait border-[#E8A23D] bg-[#FFF8E9]' : isDragging ? 'border-[#E8A23D] bg-[#FFF8E9]' : 'border-[#D9D3C5] bg-white hover:border-[#E8A23D]'}`}
      >
        <div className="w-full">
          <p className="text-sm font-black text-[#514D45]">{uploadProgress === null ? 'Drop lecture files here or browse' : `Uploading... ${uploadProgress}%`}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#8B8578]">PDF, DOCX, PPTX, and TXT · 50 MB combined maximum</p>
          {uploadProgress !== null && <div className="mx-auto mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-[#E4DFD4]" aria-hidden="true"><div className="h-full rounded-full bg-[#E8A23D] transition-[width] duration-300" style={{ width: `${uploadProgress}%` }} /></div>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          multiple
          className="sr-only"
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>

      {error && <p role="alert" className="mt-3 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-800">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-3 w-full space-y-2">
          {files.map((file) => (
            <li key={fileKey(file)} className="flex w-full flex-col gap-2 rounded-lg bg-white px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="min-w-0 truncate font-bold text-[#514D45]">{file.name}</span>
              <span className="shrink-0 font-semibold text-[#8B8578]">{formatMegabytes(file.size)}</span>
              <button type="button" disabled={uploadProgress !== null} onClick={() => { uploadedUrlsRef.current.delete(fileKey(file)); onFilesChange(files.filter((item) => item !== file)); publishUploadedUrls(); }} className="min-h-11 shrink-0 self-start px-2 text-left font-black text-[#B44134] hover:underline disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto sm:text-right">Remove</button>
            </li>
          ))}
        </ul>
      )}

      <label htmlFor="focus-prompt" className="mt-5 block w-full text-xs font-black uppercase tracking-[0.16em] text-[#9A5D00]">Focus Prompt</label>
      <textarea
        id="focus-prompt"
        value={focusText}
        onChange={(event) => onFocusTextChange(event.target.value)}
        placeholder="Focus only on the clinical presentations in these slides"
        rows={3}
        className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[#D9D3C5] bg-white px-4 py-3 text-sm font-medium leading-6 text-[#27231D] outline-none placeholder:text-[#AAA397] focus:border-[#E8A23D]"
      />
    </section>
  );
}
