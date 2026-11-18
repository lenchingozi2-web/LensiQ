'use client';

import { useCallback, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const STUDY_RAG_MAX_FILES=25;
export const STUDY_RAG_MAX_BYTES=70*1024*1024;
export type SyllabusTreeNode={
  id:string;title:string;parent_id:string|null;node_type:'module'|'topic'|'concept';
  sort_order:number;source_citations_json?:Array<{file_name:string;page_number:number|null}>;
};
export type StudyRAGProgress={stage:string;current:number;total:number;detail?:string};
type SearchHit={id:string;text:string;source:{fileName:string;pageOrSlide:number|null};score:number};
const supported=/\.(?:pdf|doc|docx|pptx|txt)$/i;
async function postJson(url:string,value:Record<string,unknown>){
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value),cache:'no-store'});
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(payload?.error||'Study material request failed');
  return payload;
}
export function useHybridStudyRAG(){
  const [files,setFiles]=useState<File[]>([]);
  const [syllabusId,setSyllabusId]=useState<string|null>(null);
  const [tree,setTree]=useState<SyllabusTreeNode[]>([]);
  const [status,setStatus]=useState<'idle'|'uploading'|'compiling'|'ready'|'error'>('idle');
  const [progress,setProgress]=useState<StudyRAGProgress|null>(null);
  const [error,setError]=useState('');
  const [lastSearch,setLastSearch]=useState<SearchHit[]>([]);
  const busyRef=useRef(false);
  const ready=status==='ready'&&Boolean(syllabusId);
  const addFiles=useCallback((incoming:File[])=>{
    setFiles(current=>{
      const seen=new Set(current.map(file=>[file.name,file.size,file.lastModified].join(':')));
      const next=[...current];
      for(const file of incoming){
        if(!supported.test(file.name)){setError('Use PDF, DOC, DOCX, PPTX or TXT documents.');continue;}
        const key=[file.name,file.size,file.lastModified].join(':');
        if(!seen.has(key)){next.push(file);seen.add(key);}
      }
      if(next.length>STUDY_RAG_MAX_FILES||next.reduce((sum,file)=>sum+file.size,0)>STUDY_RAG_MAX_BYTES){
        setError('Up to 25 documents, combined maximum 70 MiB. Remove some files before uploading.');
        return current;
      }
      setStatus('idle');setError('');setSyllabusId(null);setTree([]);
      return next;
    });
  },[]);
  const removeFile=useCallback((index:number)=>{setFiles(current=>current.filter((_,i)=>i!==index));setStatus('idle');setSyllabusId(null);setTree([]);},[]);
  const clear=useCallback(()=>{setFiles([]);setSyllabusId(null);setTree([]);setStatus('idle');setProgress(null);setError('');},[]);
  const loadTree=useCallback(async(id:string):Promise<SyllabusTreeNode[]>=>{
    const client=createClient();
    const {data:syllabus,error:syllabusError}=await client.from('study_syllabi').select('active_generation,status').eq('id',id).maybeSingle();
    if(syllabusError||syllabus?.status!=='ready')throw new Error('The syllabus has not been published');
    const {data:nodes,error:nodesError}=await client.from('syllabus_concept_nodes')
      .select('id,title,parent_id,node_type,sort_order,source_citations_json')
      .eq('syllabus_id',id).eq('generation',syllabus.active_generation)
      .order('sort_order',{ascending:true});
    if(nodesError)throw new Error('Unable to retrieve the master syllabus tree');
    const results=(nodes||[]) as SyllabusTreeNode[];
    setTree(results);
    return results;
  },[]);
  const uploadAndCompile=useCallback(async():Promise<string>=>{
    if(busyRef.current)throw new Error('Compilation is already running');
    if(!files.length)throw new Error('Choose at least one study document');
    const size=files.reduce((sum,file)=>sum+file.size,0);
    if(files.length>STUDY_RAG_MAX_FILES||size>STUDY_RAG_MAX_BYTES)throw new Error('Syllabus exceeds 25 files or 70 MiB');
    busyRef.current=true;
    let newSyllabusId:string|null=null;
    setStatus('uploading');setError('');setProgress({stage:'reserving',current:0,total:files.length});
    try{
      const preparation=await postJson('/api/rag/ingest-batch',{
        action:'prepare',files:files.map(file=>({name:file.name,size:file.size,type:file.type})),
      }) as {syllabusId:string;uploads:Array<{documentId:string;path:string;token:string}>};
      newSyllabusId=preparation.syllabusId;
      setSyllabusId(newSyllabusId);
      if(preparation.uploads.length!==files.length)throw new Error('File reservation count was inconsistent');
      const client=createClient();
      let completed=0,nextIndex=0;
      const worker=async()=>{
        while(nextIndex<files.length){
          const index=nextIndex++;
          const file=files[index],item=preparation.uploads[index];
          const {error:uploadError}=await client.storage.from('ephemeral_class_materials')
            .uploadToSignedUrl(item.path,item.token,file,{contentType:file.type||undefined,upsert:false});
          if(uploadError)throw new Error('Upload failed for '+file.name+': '+uploadError.message);
          await postJson('/api/rag/ingest-batch',{action:'confirm',documentId:item.documentId});
          completed++;
          setProgress({stage:'uploading',current:completed,total:files.length,detail:file.name});
        }
      };
      await Promise.all(Array.from({length:Math.min(3,files.length)},()=>worker()));
      setStatus('compiling');setProgress({stage:'parsing',current:0,total:files.length});
      const response=await fetch('/api/rag/compile-syllabus',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({syllabusId:newSyllabusId}),cache:'no-store',
      });
      if(!response.ok||!response.body)throw new Error('Syllabus compilation service is unavailable');
      const reader=response.body.getReader(),decoder=new TextDecoder();
      let pending='',complete=false;
      const handle=(message:string)=>{
        const event=message.split('\n').find(line=>line.startsWith('event: '))?.slice(7).trim()||'';
        const dataLine=message.split('\n').find(line=>line.startsWith('data: '));
        if(!dataLine)return;
        const data=JSON.parse(dataLine.slice(6));
        if(event==='error')throw new Error(data.error||'Syllabus compilation failed');
        if(event==='progress')setProgress({stage:data.stage,current:data.current,total:data.total,detail:data.detail});
        if(event==='complete')complete=true;
      };
      try{
        for(;;){
          const read=await reader.read();
          if(read.done)break;
          pending+=decoder.decode(read.value,{stream:true}).replace(/\r\n/g,'\n');
          const messages=pending.split('\n\n');pending=messages.pop()||'';
          for(const message of messages)handle(message);
        }
        if(pending.trim())handle(pending);
      }finally{reader.releaseLock();}
      if(!complete)throw new Error('Syllabus compilation ended without a completion acknowledgment');
      await loadTree(newSyllabusId);
      setProgress({stage:'ready',current:files.length,total:files.length});
      setStatus('ready');
      return newSyllabusId;
    }catch(caught){
      const message=caught instanceof Error?caught.message:'Unable to compile study files';
      setError(message);setStatus('error');
      if(newSyllabusId){
        void postJson('/api/rag/cleanup',{action:'purge-syllabus',syllabusId:newSyllabusId}).catch(()=>{
          console.warn('Failed syllabus cleanup will be retried by the automatic sweep');
        });
      }
      throw caught;
    }finally{busyRef.current=false;}
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
  return {files,addFiles,removeFile,clear,syllabusId,tree,status,ready,progress,error,lastSearch,uploadAndCompile,loadTree,search,sweepStale};
}
