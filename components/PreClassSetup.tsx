'use client';

import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { isLegacyWordDocument, isSupportedLectureFile, LECTURE_FILE_ACCEPT, normalizeLectureFileName, normalizeLectureMimeType } from '@/lib/curriculum/file-types';

const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

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

async function hasLegacyWordSignature(file: File) {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const compoundFileSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return header.length === compoundFileSignature.length && compoundFileSignature.every((byte, index) => header[index] === byte);
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
  const uploadedPathsRef = useRef(new Map<string, string>());
  const uploadFolderRef = useRef<string | null>(null);
  const totalBytes = files.reduce((total, file) => total + file.size, 0);

  const publishUploadedUrls = () => {
    const urls = Array.from(uploadedUrlsRef.current.values());
    onUploadedFileUrlsChange?.(urls);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('lensiq:uploaded-materials', { detail: { urls, paths: Array.from(uploadedPathsRef.current.values()) } }));
  };
  useEffect(() => {
    const clearMaterials = () => {
      uploadedUrlsRef.current.clear();
      uploadedPathsRef.current.clear();
      uploadFolderRef.current = null;
      onFilesChange([]);
      onUploadedFileUrlsChange?.([]);
    };
    window.addEventListener('lensiq:clear-uploaded-materials', clearMaterials);
    return () => window.removeEventListener('lensiq:clear-uploaded-materials', clearMaterials);
  }, [onFilesChange, onUploadedFileUrlsChange]);

  const addFiles = async (incomingFiles: File[]) => {
    setError('');
    const legacyWordFiles = new Set<File>();
    const fileKinds = await Promise.all(incomingFiles.map(async (file) => {
      const isLegacyDoc = isLegacyWordDocument(file.name, file.type) || (
        !isSupportedLectureFile(file.name, file.type) && await hasLegacyWordSignature(file)
      );
      if (isLegacyDoc) legacyWordFiles.add(file);
      return { file, accepted: isSupportedLectureFile(file.name, file.type) || isLegacyDoc };
    }));
    const invalidFiles = fileKinds.filter(({ accepted }) => !accepted).map(({ file }) => file);
    const validFiles = fileKinds.filter(({ accepted }) => accepted).map(({ file }) => file);

    if (invalidFiles.length > 0) {
      setError(`Unsupported file${invalidFiles.length === 1 ? '' : 's'}: ${invalidFiles.map((file) => file.name).join(', ')}. Use PDF, DOC, DOCX, PPTX, or TXT.`);
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
    const oversizedLegacyDoc = newFiles.find((file) => legacyWordFiles.has(file) && file.size > 20 * 1024 * 1024);
    if (oversizedLegacyDoc) {
      setError(`${oversizedLegacyDoc.name} is larger than the 20 MB conversion limit for legacy DOC files. Save it as DOCX or PDF and try again.`);
      return;
    }

    if (newFiles.length === 0) return;

    setUploadProgress(0);
    const uploadedFiles: File[] = [];
    try {
      if (typeof window === 'undefined') throw new Error('File uploads are only available in the browser.');
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in before uploading Live Class material.');
      const uploadFolder = uploadFolderRef.current ?? `class_${Date.now()}_${window.crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
      uploadFolderRef.current = uploadFolder;
      for (const [index, file] of newFiles.entries()) {
        const sourceMimeType = legacyWordFiles.has(file) ? 'application/msword' : file.type;
        const uploadName = normalizeLectureFileName(file.name, sourceMimeType);
        const safeName = uploadName.replace(/[^a-zA-Z0-9._-]/g, '_');
        if (legacyWordFiles.has(file)) {
          const formData = new FormData();
          formData.append('file', file, uploadName);
          const response = await fetch('/api/voice/materials', { method: 'POST', body: formData });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.signedUrl || !result.path) {
            throw new Error(result.error || `Unable to extract ${file.name} for Live Class.`);
          }
          uploadedUrlsRef.current.set(fileKey(file), result.signedUrl);
          uploadedPathsRef.current.set(fileKey(file), result.path);
          uploadedFiles.push(file);
          setUploadProgress(Math.round(((index + 1) / newFiles.length) * 100));
          continue;
        }
        const filePath = `${user.id}/${uploadFolder}/${safeName}`;
        const contentType = normalizeLectureMimeType(uploadName, file.type);
        const { error: uploadError } = await supabase.storage
          .from('ephemeral_class_materials')
          .upload(filePath, file, { contentType, upsert: false });
        if (uploadError) throw new Error(`Unable to upload ${file.name}: ${uploadError.message}`);
        const { data: signedData, error: signedError } = await supabase.storage
          .from('ephemeral_class_materials')
          .createSignedUrl(filePath, 60 * 60);
        if (signedError || !signedData?.signedUrl) throw new Error(`Unable to authorize ${file.name} for Live Class.`);
        uploadedUrlsRef.current.set(fileKey(file), signedData.signedUrl);
        uploadedPathsRef.current.set(fileKey(file), filePath);
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
    <section className="w-full rounded-2xl border border-white/10 bg-[#101827]/78 px-4 py-4 shadow-[0_24px_72px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:px-5 sm:py-5">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd68d]">Pre-Class Setup</p>
          <h2 className="mt-1 text-base font-black text-white sm:text-lg">Bring your study material</h2>
        </div>
        <p className="w-full text-xs font-bold text-white/50 sm:w-auto">{files.length}/{MAX_FILES} files · {formatMegabytes(totalBytes)} / 50 MB used</p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => { if (uploadProgress === null) inputRef.current?.click(); }}
        onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && uploadProgress === null) { event.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`mt-4 flex min-h-28 w-full items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${uploadProgress !== null ? 'cursor-wait border-[#E8A23D] bg-[#E8A23D]/10' : isDragging ? 'border-[#E8A23D] bg-[#E8A23D]/10' : 'border-white/15 bg-[#080D16]/70 hover:border-[#E8A23D]/80 hover:bg-white/[0.035]'}`}
      >
        <div className="w-full">
          <p className="text-sm font-black text-white/90">{uploadProgress === null ? 'Drop lecture files here or browse' : `Uploading... ${uploadProgress}%`}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-white/45">PDF, DOC, DOCX, PPTX, and TXT · 50 MB combined maximum</p>
          {uploadProgress !== null && <div className="mx-auto mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/10" aria-hidden="true"><div className="h-full rounded-full bg-[#E8A23D] transition-[width] duration-300" style={{ width: `${uploadProgress}%` }} /></div>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={LECTURE_FILE_ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            void addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>

      {error && <p role="alert" className="mt-3 w-full break-words rounded-lg border border-rose-300/20 bg-rose-500/[0.09] px-3 py-2 text-xs font-bold leading-5 text-rose-200">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-3 w-full space-y-2">
          {files.map((file) => (
            <li key={fileKey(file)} className="flex w-full flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="min-w-0 truncate font-bold text-white/80">{file.name}</span>
              <span className="shrink-0 font-semibold text-white/40">{formatMegabytes(file.size)}</span>
              <button type="button" disabled={uploadProgress !== null} onClick={() => { uploadedUrlsRef.current.delete(fileKey(file)); onFilesChange(files.filter((item) => item !== file)); publishUploadedUrls(); }} className="min-h-11 shrink-0 self-start px-2 text-left font-black text-rose-300 hover:underline disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto sm:text-right">Remove</button>
            </li>
          ))}
        </ul>
      )}

      <label htmlFor="focus-prompt" className="mt-5 block w-full text-xs font-black uppercase tracking-[0.18em] text-[#ffd68d]">Focus Prompt</label>
      <textarea
        id="focus-prompt"
        value={focusText}
        onChange={(event) => onFocusTextChange(event.target.value)}
        placeholder="Focus only on the clinical presentations in these slides"
        rows={3}
        className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/12 bg-[#080D16]/75 px-4 py-3 text-sm font-medium leading-6 text-white/90 outline-none placeholder:text-white/35 focus:border-[#E8A23D] focus:ring-2 focus:ring-[#E8A23D]/20"
      />
    </section>
  );
}
