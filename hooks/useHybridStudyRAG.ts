'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadStudyDocumentToSignedUrl } from '@/lib/rag/signed-upload';

import { inPool, retryStep } from '@/lib/rag/compile-pool';

export const STUDY_RAG_MAX_FILES=25;
export const STUDY_RAG_MAX_BYTES=70*1024*1024;
export type SyllabusTreeNode={
  id:string;title:string;parent_id:string|null;node_type:'module'|'topic'|'concept';
  sort_order:number;source_citations_json?:Array<{file_name:string;page_number:number|null}>;
};
export type StudyRAGProgress={stage:string;current:number;total:number;detail?:string};
type SearchHit={id:string;text:string;source:{fileName:string;pageOrSlide:number|null};score:number};
const supported=/\.(?:pdf|doc|docx|pptx|txt)$/i;
async function postJson(url:string,value:Record<string,unknown>, signal?:AbortSignal){
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value),cache:'no-store',signal});
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(payload?.error||'Study material request failed');
  return payload;
}
const subscribeToHydration=()=>()=>{};
export function useHybridStudyRAG(){
  const interactive=useSyncExternalStore(subscribeToHydration,()=>true,()=>false);
  const [files,setFiles]=useState<File[]>([]);
  const [syllabusId,setSyllabusId]=useState<string|null>(null);
  const [tree,setTree]=useState<SyllabusTreeNode[]>([]);
  const [status,setStatus]=useState<'idle'|'uploading'|'compiling'|'ready'|'error'>('idle');
  const [progress,setProgress]=useState<StudyRAGProgress|null>(null);
  const [error,setError]=useState('');
  const [lastSearch,setLastSearch]=useState<SearchHit[]>([]);
  const busyRef=useRef(false);
  const [ready,setReady]=useState(false);
  const [flagged,setFlagged]=useState<string[]>([]);
  const jobRef=useRef<AbortController|null>(null);
  const checkpoint=useRef<string|null>(null);
  const [resumeId,setResumeId]=useState<string|null>(null);
  const invalidate=useCallback(()=>{
    const old=checkpoint.current;
    jobRef.current?.abort();jobRef.current=null;busyRef.current=false;checkpoint.current=null;
    sessionStorage.removeItem('lensiq.pending-syllabus');setResumeId(null);setReady(false);setProgress(null);
    if(old)void postJson('/api/rag/cleanup',{action:'purge-syllabus',syllabusId:old}).catch(()=>undefined);
  },[]);
  useEffect(()=>{
    const id=sessionStorage.getItem('lensiq.pending-syllabus');
    if(id){checkpoint.current=id;queueMicrotask(()=>setResumeId(id));}
    return ()=>jobRef.current?.abort();
  },[]);
  const addFiles=useCallback((incoming:File[])=>{
    const seen=new Set(files.map(file=>[file.name,file.size,file.lastModified].join(':')));
    const next=[...files];
    for(const file of incoming){
      if(!supported.test(file.name)){setError('Use PDF, DOC, DOCX, PPTX or TXT documents.');return;}
      const key=[file.name,file.size,file.lastModified].join(':');
      if(!seen.has(key)){next.push(file);seen.add(key);}
    }
    if(next.length>STUDY_RAG_MAX_FILES||next.reduce((sum,file)=>sum+file.size,0)>STUDY_RAG_MAX_BYTES){
      setError('Up to 25 documents, combined maximum 70 MiB. Remove some files before uploading.');return;
    }
    invalidate();setFiles(next);setStatus('idle');setError('');setSyllabusId(null);setTree([]);
  },[files,invalidate]);
  const removeFile=useCallback((index:number)=>{invalidate();setFiles(current=>current.filter((_,i)=>i!==index));setStatus('idle');setSyllabusId(null);setTree([]);},[invalidate]);
  const clear=useCallback(()=>{jobRef.current?.abort();jobRef.current=null;busyRef.current=false;
    checkpoint.current=null;sessionStorage.removeItem('lensiq.pending-syllabus');setResumeId(null);setFlagged([]);setReady(false);setFiles([]);setSyllabusId(null);setTree([]);setStatus('idle');setProgress(null);setError('');},[]);
  const discard=useCallback(()=>{
    const id=checkpoint.current;clear();
    if(id)void postJson('/api/rag/cleanup',{action:'purge-syllabus',syllabusId:id}).catch(()=>undefined);
  },[clear]);
  const validate=useCallback(async()=>{
    const id=checkpoint.current;
    if(!id)return true;
    const client=createClient();
    const {data,error}=await client.from('study_syllabi').select('status,expires_at,session_id').eq('id',id).maybeSingle();
    if(error)throw new Error('Unable to check your prepared class. Please retry.');
    let usable=Boolean(data&&['compiling','ready'].includes(data.status)&&Date.parse(data.expires_at)>Date.now());
    if(usable&&data?.session_id){
      const session=await client.from('live_class_sessions').select('status').eq('id',data.session_id).maybeSingle();
      if(session.error)throw new Error('Unable to check your previous class. Please retry.');
      usable=session.data?.status==='active';
    }
    if(!usable){clear();return false;}
    return true;
  },[clear]);
  const loadTree=useCallback(async(id:string):Promise<SyllabusTreeNode[]>=>{
    const client=createClient();
    const {data:syllabus,error}=await client.from('study_syllabi').select('active_generation,staging_generation,status,expires_at').eq('id',id).maybeSingle();
    if(error||!syllabus||!['compiling','ready'].includes(syllabus.status)||Date.parse(syllabus.expires_at)<=Date.now())throw new Error('Syllabus is no longer available');
    const results:SyllabusTreeNode[]=[];
    for(let from=0;;from+=500){
      const page=await client.from('syllabus_concept_nodes').select('id,title,parent_id,node_type,sort_order,source_citations_json')
        .eq('syllabus_id',id).eq('generation',syllabus.staging_generation??syllabus.active_generation)
        .order('sort_order').order('id').range(from,from+499);
      if(page.error)throw new Error('Unable to retrieve the syllabus tree');
      results.push(...(page.data||[]) as SyllabusTreeNode[]);
      if(!page.data||page.data.length<500)break;
    }
    if(checkpoint.current===id)setTree(results);
    return results;
  },[]);
  const uploadAndCompile=useCallback(async(overrideFiles?:File[],sessionId?:string)=>{
    if(busyRef.current)return;
    const selected=overrideFiles??files;
    let id=checkpoint.current;
    if(!selected.length&&!id)throw new Error('Choose at least one study document');
    const job=new AbortController(), signal=job.signal;
    jobRef.current=job;busyRef.current=true;
    setError('');setFlagged([]);
    try{
      if(!id){
        setStatus('uploading');setProgress({stage:'Uploading',current:0,total:selected.length});
        const prepared=await postJson('/api/rag/ingest-batch',{action:'prepare',sessionId,
          files:selected.map(f=>({name:f.name,size:f.size,type:f.type}))},signal);
        id=String(prepared.syllabusId);
        if(prepared.uploads.length!==selected.length)throw new Error('File reservation count mismatch');
        const client=createClient();let uploaded=0;
        await inPool(selected,async(file,i)=>{
          signal.throwIfAborted();
          const item=prepared.uploads[i];
          const {error}=await uploadStudyDocumentToSignedUrl(client,item,file);
          if(error)throw new Error(file.name+': '+error.message);
          await retryStep(()=>postJson('/api/rag/ingest-batch',{action:'confirm',documentId:item.documentId},signal),signal);
          setProgress({stage:'Uploading',current:++uploaded,total:selected.length,detail:file.name});
        });
        signal.throwIfAborted();checkpoint.current=id;setResumeId(id);sessionStorage.setItem('lensiq.pending-syllabus',id);
      }
      const syllabus=id;
      setSyllabusId(syllabus);setStatus('compiling');
      const step=(action:string,itemId?:string,offset?:number)=>retryStep(()=>postJson('/api/rag/compile-syllabus',
        {syllabusId:syllabus,action,itemId,offset},AbortSignal.any([signal,AbortSignal.timeout(52000)])),signal);
      const plan=await step('prepare');
      const docs=plan.documents as {id:string;indexed:boolean}[];
      const completed=new Set<string>();let total=0;
      const enrich=async(node:SyllabusTreeNode)=>{
        try{await step('node',node.id);}
        catch(failure){signal.throwIfAborted();setFlagged(old=>[...old,node.title]);if(!completed.size)console.warn('Using indexed source text',failure instanceof Error?failure.name:'');}
        signal.throwIfAborted();completed.add(node.id);
        setProgress({stage:'Preparing concepts',current:completed.size,total,detail:node.title});
      };
      let firstOffset=0;
      if(!docs[0].indexed){
        setProgress({stage:'Reading first document',current:0,total:docs.length});
        const first=await step('parse',docs[0].id,0);
        docs[0].indexed=first.done;firstOffset=first.next??0;
      }
      const firstTree=await retryStep(()=>loadTree(syllabus),signal);
      const firstNodes=firstTree.filter(n=>n.node_type==='concept');
      if(!firstNodes.length)throw new Error('No readable concepts were indexed');
      total=firstNodes.length;
      // These nodes already contain the complete cited source and a usable visual.
      // Semantic vectors and optional Flash layout hints must never hold the classroom door.
      signal.throwIfAborted();setReady(true);
      await inPool(firstNodes.slice(0,2),enrich);
      let parsed=docs.filter(d=>d.indexed).length;
      // Publish source pages in lecture order. Parallel document parsing could
      // expose a later lecture before an earlier one, causing the tutor to
      // append the missing earlier concepts after the later lecture.
      // Optional concept enrichment still uses the bounded three-way pool.
      for(const [i,doc] of docs.entries()){
        if(doc.indexed)continue;
        let offset=i===0?firstOffset:0;
        for(;;){
          const result=await step('parse',doc.id,offset);
          if(result.done)break;
          offset=result.next;
        }
        doc.indexed=true;
        setProgress({stage:'Indexing documents',current:++parsed,total:docs.length});
        // Newly indexed, cited concepts become navigable during the lesson.
        await retryStep(()=>loadTree(syllabus),signal).catch(()=>signal.throwIfAborted());
      }
      if(!plan.published)await step('publish');
      const nodes=(await retryStep(()=>loadTree(syllabus),signal)).filter(n=>n.node_type==='concept');
      total=nodes.length;
      await inPool(nodes.filter(n=>!completed.has(n.id)),enrich);
      signal.throwIfAborted();setStatus('ready');
      setProgress({stage:'Source index ready',current:total,total});
    }catch(caught){
      if(signal.aborted)return;
      setError(caught instanceof Error?caught.message:'Unable to prepare study material');setStatus('error');
      throw caught;
    }finally{if(jobRef.current===job)busyRef.current=false;}
  },[files,loadTree]);
  const search=useCallback(async(query:string,semantic=false):Promise<SearchHit[]>=>{
    if(!syllabusId)return[];
    const response=await postJson('/api/rag/retrieve-hybrid',{syllabusId,query,searchMode:semantic?'semantic':'instant'});
    const hits=(response.matches||[]) as SearchHit[];
    setLastSearch(hits);
    return hits;
  },[syllabusId]);
  const sweepStale=useCallback(async()=>{
    return postJson('/api/rag/cleanup',{action:'sweep'});
  },[]);
  return {interactive,files,addFiles,removeFile,clear,discard,validate,syllabusId,tree,status,ready,progress,error,flagged,resumeId,lastSearch,uploadAndCompile,loadTree,search,sweepStale};
}
