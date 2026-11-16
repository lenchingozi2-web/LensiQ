import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET='ephemeral_class_materials';
type CleanupOutcome={syllabusId:string;deletedFiles:number;purged:true};
function errorIf(error:{message:string}|null,stage:string):void{
  if(error)throw new Error(stage+': '+error.message);
}
function validPath(path:string,userId:string,syllabusId:string):boolean{
  const prefix=userId+'/'+syllabusId+'/';
  return path.startsWith(prefix) && /^[a-f0-9-]{36}\.(?:pdf|doc|docx|pptx|txt)$/i.test(path.slice(prefix.length));
}
/** All deletes are via the Storage API, never direct SQL on storage.objects.
 * A failed delete leaves 'purging' state for safe retry during the next sweep. */
export async function purgeSyllabusMaterials(admin:SupabaseClient,userId:string,syllabusId:string):Promise<CleanupOutcome>{
  const {data:syllabus,error:readError}=await admin.from('study_syllabi').select('id,status,user_id')
    .eq('id',syllabusId).eq('user_id',userId).maybeSingle();
  errorIf(readError,'Read syllabus for purge');
  if(!syllabus)throw new Error('Syllabus not found for owner');
  if(syllabus.status==='purged')return{syllabusId,deletedFiles:0,purged:true};
  const {error:markError}=await admin.from('study_syllabi').update({status:'purging',updated_at:new Date().toISOString()})
    .eq('id',syllabusId).eq('user_id',userId).neq('status','purged');
  errorIf(markError,'Lock syllabus for purge');
  const {data:documents,error:docsError}=await admin.from('study_documents')
    .select('storage_path').eq('syllabus_id',syllabusId).eq('user_id',userId);
  errorIf(docsError,'Read tracked documents');
  const paths=[...new Set((documents||[]).map(doc=>String(doc.storage_path)).filter(path=>validPath(path,userId,syllabusId)))];
  if(paths.length!==(documents||[]).filter(doc=>doc.storage_path).length)throw new Error('Unsafe or untracked source path detected; refusing partial wipe');
  // All file objects must be removed before the quota and index are reset.
  for(let i=0;i<paths.length;i+=50){
    const {error}=await admin.storage.from(BUCKET).remove(paths.slice(i,i+50));
    errorIf(error,'Delete class source binaries');
  }
  const {error:chunksError}=await admin.from('document_atomic_chunks').delete()
    .eq('syllabus_id',syllabusId).eq('user_id',userId);
  errorIf(chunksError,'Delete session vectors');
  const {error:nodesError}=await admin.from('syllabus_concept_nodes').delete()
    .eq('syllabus_id',syllabusId).eq('user_id',userId);
  errorIf(nodesError,'Delete large compiled notes');
  const {error:documentsError}=await admin.from('study_documents').delete()
    .eq('syllabus_id',syllabusId).eq('user_id',userId);
  errorIf(documentsError,'Delete session document metadata');
  const {error:finishError}=await admin.from('study_syllabi').update({
    status:'purged',reserved_bytes:0,used_bytes:0,active_generation:0,
    staging_generation:null,purged_at:new Date().toISOString(),updated_at:new Date().toISOString(),
  }).eq('id',syllabusId).eq('user_id',userId);
  errorIf(finishError,'Complete syllabus purge');
  return{syllabusId,deletedFiles:paths.length,purged:true};
}
export async function purgeSessionMaterialsOnEnd(admin:SupabaseClient,userId:string,sessionId:string):Promise<CleanupOutcome[]>{
  const {data,error}=await admin.from('study_syllabi').select('id').eq('user_id',userId).eq('session_id',sessionId).neq('status','purged');
  errorIf(error,'Read session syllabi');
  const outcomes:CleanupOutcome[]=[];
  for(const syllabus of data||[])outcomes.push(await purgeSyllabusMaterials(admin,userId,syllabus.id));
  return outcomes;
}
export async function purgeRawFilesAfterCompile(admin:SupabaseClient,userId:string,syllabusId:string):Promise<number>{
  const {data:syllabus,error:syllabusError}=await admin.from('study_syllabi').select('status').eq('id',syllabusId).eq('user_id',userId).maybeSingle();
  errorIf(syllabusError,'Verify compiled syllabus');
  if(syllabus?.status!=='ready')throw new Error('Raw file purge requires an already published syllabus');
  const {data:docs,error}=await admin.from('study_documents').select('id,storage_path')
    .eq('syllabus_id',syllabusId).eq('user_id',userId).in('status',['uploaded','indexed']);
  errorIf(error,'Read compiled uploads');
  const paths=(docs||[]).map(doc=>String(doc.storage_path));
  if(paths.some(path=>!validPath(path,userId,syllabusId)))throw new Error('Invalid storage path');
  for(let i=0;i<paths.length;i+=50){
    const {error:removeError}=await admin.storage.from(BUCKET).remove(paths.slice(i,i+50));
    errorIf(removeError,'Delete compiled source file');
  }
  for(const doc of docs||[]){
    const {error:updateError}=await admin.from('study_documents').update({status:'removed',actual_size_bytes:0})
      .eq('id',doc.id).eq('user_id',userId);
    errorIf(updateError,'Mark deleted original');
  }
  const {error:releaseError}=await admin.from('study_syllabi').update({used_bytes:0,reserved_bytes:0,updated_at:new Date().toISOString()})
    .eq('id',syllabusId).eq('user_id',userId).eq('status','ready');
  errorIf(releaseError,'Release binary reservation');
  return paths.length;
}
export async function sweepExpiredSyllabi(admin:SupabaseClient,userId:string,max=20):Promise<{purged:number;failed:number}>{
  const {data,error}=await admin.from('study_syllabi').select('id,status')
    .eq('user_id',userId).neq('status','purged')
    .or('expires_at.lt.'+new Date().toISOString()+',status.eq.purging')
    .order('created_at',{ascending:true}).limit(max);
  errorIf(error,'Find expired syllabus sessions');
  let purged=0,failed=0;
  for(const syllabus of data||[]){
    try{await purgeSyllabusMaterials(admin,userId,syllabus.id);purged++;}catch(error){
      failed++;console.error('Expired syllabus cleanup retry pending',syllabus.id,error instanceof Error?error.message:'unknown');
    }
  }
  return{purged,failed};
}

/** Invoked by authenticated scheduled maintenance. Limit work per invocation,
 * including previously interrupted purges, to avoid unbounded serverless runtime. */
export async function sweepAllExpiredSyllabi(admin:SupabaseClient,max=25):Promise<{purged:number;failed:number}>{
  const {data,error}=await admin.from('study_syllabi').select('id,user_id')
    .neq('status','purged')
    .or('expires_at.lt.'+new Date().toISOString()+',status.eq.purging')
    .order('created_at',{ascending:true}).limit(max);
  errorIf(error,'Find globally expired syllabi');
  let purged=0,failed=0;
  for(const syllabus of data||[]){
    try{await purgeSyllabusMaterials(admin,syllabus.user_id,syllabus.id);purged++;}catch(error){
      failed++;console.error('Scheduled expired syllabus cleanup needs retry',syllabus.id,error instanceof Error?error.message:'unknown');
    }
  }
  return{purged,failed};
}
