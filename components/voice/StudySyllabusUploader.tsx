'use client';

import type { ChangeEvent } from 'react';
import { STUDY_RAG_MAX_BYTES, STUDY_RAG_MAX_FILES, useHybridStudyRAG } from '@/hooks/useHybridStudyRAG';

type HookValue=ReturnType<typeof useHybridStudyRAG>;
export default function StudySyllabusUploader({rag,focusText,onFocusTextChange}:{
  rag:HookValue;focusText:string;onFocusTextChange:(value:string)=>void;
}){
  const bytes=rag.files.reduce((total,file)=>total+file.size,0);
  const onChoose=(event:ChangeEvent<HTMLInputElement>)=>{
    rag.addFiles(Array.from(event.currentTarget.files||[]));
    event.currentTarget.value='';
  };
  const working=rag.status==='uploading'||rag.status==='compiling';
  return <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4" aria-label="Master syllabus document upload">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-black text-white">Master student syllabus</h2>
      <span className="text-xs font-semibold text-white/60">{rag.files.length}/{STUDY_RAG_MAX_FILES} files · {(bytes/(1024*1024)).toFixed(1)} / {(STUDY_RAG_MAX_BYTES/(1024*1024)).toFixed(0)} MiB</span>
    </div>
    <p className="text-xs leading-5 text-white/65">Upload your lecture notes once. LenxiQ builds a private, cited topic tree and keeps repeated facts only once. Raw files and compiled vectors are erased after your class.</p>
    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#E8A23D]/50 bg-[#E8A23D]/[0.07] px-4 py-4 text-center text-sm font-bold text-[#FFE2A8] hover:bg-[#E8A23D]/15">
      Choose PDF, DOC, DOCX, PPTX or TXT files
      <input type="file" multiple accept=".pdf,.doc,.docx,.pptx,.txt" onChange={onChoose}
        disabled={working||rag.ready||Boolean(rag.resumeId)} className="sr-only" aria-label="Choose study documents" />
    </label>
    {rag.files.length>0 && <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-black/25 p-2">
      {rag.files.map((file,index)=><div key={file.name+file.size+file.lastModified} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
        <span className="min-w-0 truncate text-xs text-white/75">{file.name} · {(file.size/(1024*1024)).toFixed(1)} MiB</span>
        {!working&&!rag.ready&&<button type="button" onClick={()=>rag.removeFile(index)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/10">Remove</button>}
      </div>)}
    </div>}
    <label className="block space-y-1 text-xs font-bold text-white/70">
      Teaching focus <span className="font-normal text-white/45">(optional)</span>
      <textarea value={focusText} onChange={event=>onFocusTextChange(event.target.value.slice(0,1200))}
        rows={2} placeholder="What should the tutor emphasize?"
        className="w-full resize-y rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-sm font-normal text-white outline-none focus:border-[#E8A23D]" />
    </label>
    {(rag.files.length>0||rag.resumeId)&&(!rag.ready||rag.status==='error')&&<button type="button" disabled={working} onClick={()=>void rag.uploadAndCompile().catch(()=>undefined)}
      className="w-full rounded-xl bg-[#E8A23D] px-4 py-3 text-sm font-black text-[#172033] disabled:cursor-wait disabled:opacity-65">
      {working?'Building your cited syllabus…':rag.resumeId?'Resume syllabus preparation':'Prepare lecture notes'}
    </button>}
    {rag.progress&&<div aria-live="polite" className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/70">
      <span>{rag.progress.stage} · {rag.progress.detail||'Organizing concepts'}</span>
      <span className="shrink-0 tabular-nums">{rag.progress.current}/{rag.progress.total}</span>
    </div>}
    {rag.ready&&<p role="status" className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
      Ready to enter · {rag.tree.filter(node=>node.node_type==='concept').length} linked concepts. Your tutor can start with the first concept.
    </p>}
    {rag.error&&<p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-200">{rag.error}</p>}
    {(rag.ready||rag.resumeId)&&!working&&<button type="button" onClick={rag.discard} className="text-xs font-bold text-white/55 underline underline-offset-2">Start again with different files</button>}
  </section>;
}
