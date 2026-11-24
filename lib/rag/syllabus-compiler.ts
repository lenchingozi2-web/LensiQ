import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractUploadedDocumentText, parseExtractedDocumentText } from './ingestor';
import { processSyllabus } from './process-syllabus';
import { compileConceptEmbeddings } from './concept-embeddings';
import {authorTeachingPacket,cachedLesson} from '@/lib/live-class/lesson-author';
import { matchCuratedClassVisual } from '@/lib/live-class/model-matcher';

const PAGE = 32;
const PARSER_VERSION = 2;
function stableId(key: string) {
  const h = createHash('sha256').update(key).digest('hex');
  return [h.slice(0,8), h.slice(8,12), '4'+h.slice(13,16), '8'+h.slice(17,20), h.slice(20,32)].join('-');
}
function check(error: {message:string} | null) {
  if (error) throw new Error(error.message);
}

export async function compileStep(userId:string, syllabusId:string, action:string, itemId:string, offset:number, signal:AbortSignal) {
  const db=createAdminClient(signal);
  if(!db)throw new Error('Study database unavailable');
  const upsertBatched=async(table:'syllabus_concept_nodes'|'document_atomic_chunks',rows:object[])=>{
    for(let from=0;from<rows.length;from+=200){
      check((await db.from(table).upsert(rows.slice(from,from+200),{ignoreDuplicates:true})).error);
    }
  };
  const scoped=()=>db.from('study_syllabi').select('status,active_generation,staging_generation,expires_at')
    .eq('id',syllabusId).eq('user_id',userId).single();
  let syllabus=(await scoped()).data;
  if(!syllabus || !['draft','compiling','ready','failed'].includes(syllabus.status) || Date.parse(syllabus.expires_at)<=Date.now())
    throw new Error('This syllabus expired or is no longer available');
  if(action==='prepare' && syllabus.status==='ready'){
    const activeModules=await db.from('syllabus_concept_nodes').select('visual_spec_json')
      .match({syllabus_id:syllabusId,user_id:userId,generation:syllabus.active_generation}).eq('node_type','module');
    check(activeModules.error);
    const stale=!activeModules.data?.length||activeModules.data.some(row=>row.visual_spec_json?.parserVersion!==PARSER_VERSION);
    if(stale){
      check((await db.from('study_syllabi').update({status:'compiling',staging_generation:syllabus.active_generation+1})
        .eq('id',syllabusId).eq('user_id',userId).eq('status','ready')).error);
      check((await db.from('study_documents').update({status:'uploaded'}).eq('syllabus_id',syllabusId)
        .eq('user_id',userId).eq('status','indexed')).error);
      syllabus=(await scoped()).data;
    }
  }
  if(!syllabus)throw new Error('Syllabus unavailable');
  if(action==='prepare' && ['draft','failed'].includes(syllabus.status)){
    const claim=await db.from('study_syllabi').update({status:'compiling',staging_generation:syllabus.active_generation+1})
      .eq('id',syllabusId).eq('user_id',userId).in('status',['draft','failed']);
    check(claim.error);syllabus=(await scoped()).data;
    if(!syllabus)throw new Error('Syllabus unavailable');
  }
  const generation=syllabus.staging_generation ?? syllabus.active_generation;
  const scope={syllabus_id:syllabusId,user_id:userId,generation};
  if(action==='lesson'){
    const found=await db.from('syllabus_concept_nodes').select('id,title,consolidated_notes,key_details_json,source_citations_json,visual_spec_json').match(scope).eq('id',itemId).eq('node_type','concept').single();
    check(found.error);
    const concept=found.data!;
    const packet=await authorTeachingPacket(syllabusId,syllabusId,1,concept,{signal});
    const latest=await db.from('syllabus_concept_nodes').select('visual_spec_json').match(scope).eq('id',itemId).single();check(latest.error);
    check((await db.from('syllabus_concept_nodes').update({visual_spec_json:{...latest.data!.visual_spec_json,authored:cachedLesson(packet,concept)}}).match(scope).eq('id',itemId)).error);
    return{done:true,teachingReady:true};
  }
  if(action==='node'){
    if(!['ready','compiling'].includes(syllabus.status))throw new Error('Source index is not ready');
    return {done:true,...await compileConceptEmbeddings(db,scope,itemId)};
  }
  const documents=await db.from('study_documents').select('id,status,original_name,storage_path')
    .eq('syllabus_id',syllabusId).eq('user_id',userId).order('created_at').order('id');
  check(documents.error);
  const docs=documents.data||[];
  if(!docs.length||docs.some(d=>!['uploaded','indexed'].includes(d.status)))throw new Error('Confirm every upload before compiling');
  if(action==='prepare')return {documents:docs.map(d=>({id:d.id,indexed:d.status==='indexed'})),published:syllabus.status==='ready'};
  if(action==='publish'){
    if(docs.some(d=>d.status!=='indexed'))throw new Error('Source indexing is incomplete');
    if(syllabus.status!=='ready'){
      const write=await db.from('study_syllabi').update({status:'ready',active_generation:generation,staging_generation:null})
        .eq('id',syllabusId).eq('user_id',userId).eq('status','compiling').eq('staging_generation',generation);
      check(write.error);
    }
    return {done:true};
  }
  const index=docs.findIndex(d=>d.id===itemId), doc=docs[index];
  if(action!=='parse'||!doc)throw new Error('Unknown document');
  if(doc.status==='indexed')return {done:true};
  const id=(key:string)=>stableId(syllabusId+'/'+generation+'/'+doc.id+'/'+key);
  const moduleId=id('module');
  if(offset===0){
    // Offset zero is the explicit restart checkpoint. Remove only this owner's
    // rows for this document in the current staging generation; the module FK
    // cascades to its topic and concept descendants.
    check((await db.from('document_atomic_chunks').delete().match(scope).eq('document_id',doc.id)).error);
    check((await db.from('syllabus_concept_nodes').delete().match(scope).eq('id',moduleId)).error);
  }
  const prior=await db.from('syllabus_concept_nodes').select('visual_spec_json').match(scope).eq('id',moduleId).maybeSingle();
  check(prior.error);
  // Documents already partly indexed retain identical node offsets.
  const legacy=Boolean(prior.data&&prior.data.visual_spec_json?.parserVersion!==PARSER_VERSION);
  const cached=await db.from('study_document_extractions').select('parser_version,extraction_json')
    .eq('document_id',doc.id).eq('user_id',userId).eq('syllabus_id',syllabusId).maybeSingle();
  check(cached.error);
  let extracted=typeof cached.data?.extraction_json?.text==='string'&&cached.data?.parser_version===PARSER_VERSION
    ?cached.data.extraction_json.text:'';
  if(!extracted){
    const download=await db.storage.from('study-documents').download(doc.storage_path);
    check(download.error);
    extracted=await extractUploadedDocumentText(new Uint8Array(await download.data!.arrayBuffer()),doc.original_name);
    const saved=await db.from('study_document_extractions').upsert({document_id:doc.id,syllabus_id:syllabusId,user_id:userId,
      parser_version:PARSER_VERSION,extraction_json:{version:PARSER_VERSION,text:extracted},extracted_at:new Date().toISOString()},{onConflict:'document_id'});
    check(saved.error);
  }
  const parsed=parseExtractedDocumentText(extracted,doc.id,doc.original_name,legacy);
  const nodes=processSyllabus([parsed],legacy);
  if(!nodes.length || offset>=nodes.length)throw new Error('No readable material at this document position');
  const limit=offset===0?2:PAGE;
  const page=nodes.slice(offset,offset+limit);
  const order=index*10_000_000+offset;
  const parents=[{...scope,id:moduleId,parent_id:null as string|null,node_type:'module',title:doc.original_name,sort_order:order-offset,visual_spec_json:{parserVersion:PARSER_VERSION} as Record<string,unknown>}];
  for(const [i,n] of page.entries()){
    const topicId=id('topic/'+n.topic);
    if(!parents.some(p=>p.id===topicId))parents.push({...scope,id:topicId,parent_id:moduleId,node_type:'topic',title:n.topic,sort_order:order+i,visual_spec_json:{}});
  }
  await upsertBatched('syllabus_concept_nodes',parents);
  const concepts=page.map((n,i)=>({...scope,id:id('node/'+(offset+i)),parent_id:id('topic/'+n.topic),node_type:'concept',
    title:n.title,sort_order:order+i,consolidated_notes:n.notes,key_details_json:n.facts,source_citations_json:n.citations,
    visual_spec_json:{...(matchCuratedClassVisual(n.title)||{mode:'whiteboard'}),
      fingerprint:createHash('sha256').update(n.title+'\n'+n.notes).digest('hex')}}));
  await upsertBatched('syllabus_concept_nodes',concepts);
  signal.throwIfAborted();
  const chunks=page.flatMap((n,i)=>n.chunks.map((chunk,j)=>({...scope,id:id('chunk/'+(offset+i)+'/'+j),document_id:doc.id,concept_node_id:concepts[i].id,
    source_file:chunk.sourceFile,page_number:chunk.pageNumber,chunk_text:chunk.text})));
  await upsertBatched('document_atomic_chunks',chunks);
  const next=offset+page.length;
  if(next<nodes.length)return {done:false,next,ids:concepts.map(n=>n.id)};
  const counted=await db.from('document_atomic_chunks').select('id',{head:true,count:'exact'}).match(scope).eq('document_id',doc.id);
  check(counted.error);
  const expectedChunks=nodes.reduce((count,node)=>count+node.chunks.length,0);
  if(counted.count!==expectedChunks)throw new Error('Document checkpoint missing. Resume parsing from the first page.');
  check((await db.from('study_documents').update({status:'indexed'}).eq('id',doc.id).eq('user_id',userId).eq('status','uploaded')).error);
  return {done:true,ids:concepts.map(n=>n.id)};
}
