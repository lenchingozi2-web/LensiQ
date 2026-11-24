import type { SupabaseClient } from '@supabase/supabase-js';
import { embedStudyText } from './embeddings';

const MAX_CHUNKS_PER_CONCEPT=2;
const MAX_EMBED_TEXT_CHARS=1_200;
type Scope={syllabus_id:string;user_id:string;generation:number};
const pending=new Map<string,Promise<{lexical:boolean}>>();

/** Compile a single concept's optional vectors; callers must choose concepts lazily. */
export async function compileConceptEmbeddings(db:SupabaseClient,scope:Scope,conceptId:string):Promise<{lexical:boolean}>{
  const key=[scope.syllabus_id,scope.user_id,scope.generation,conceptId].join(':');
  const existing=pending.get(key);
  if(existing)return existing;
  const work=(async()=>{
    const row=await db.from('syllabus_concept_nodes').select('visual_spec_json')
      .match(scope).eq('id',conceptId).eq('node_type','concept').maybeSingle();
    if(row.error)throw new Error(row.error.message);
    if(!row.data)throw new Error('Concept is no longer available');
    if(row.data.visual_spec_json?.compiled)return{lexical:Boolean(row.data.visual_spec_json.lexical)};
    const result=await db.from('document_atomic_chunks').select('id,chunk_text')
      .match(scope).eq('concept_node_id',conceptId).order('id').limit(MAX_CHUNKS_PER_CONCEPT);
    if(result.error)throw new Error(result.error.message);
    const chunks=result.data||[];
    const joined=chunks.map(chunk=>chunk.chunk_text).join('\n');
    const layout=/→|->/.test(joined)?'flow':chunks.some(chunk=>chunk.chunk_text.includes('\t'))?'comparison':'notes';
    let lexical=true;
    for(const chunk of chunks){
      const vector=await embedStudyText(chunk.chunk_text.slice(0,MAX_EMBED_TEXT_CHARS),{
        taskType:'RETRIEVAL_DOCUMENT',timeoutMs:2_200,
      });
      if(vector.values){
        lexical=false;
        const saved=await db.from('document_atomic_chunks').update({embedding:'['+vector.values.join(',')+']'})
          .match(scope).eq('id',chunk.id);
        if(saved.error)throw new Error(saved.error.message);
      }
    }
    const latest=await db.from('syllabus_concept_nodes').select('visual_spec_json')
      .match(scope).eq('id',conceptId).single();
    if(latest.error)throw new Error(latest.error.message);
    const updated=await db.from('syllabus_concept_nodes').update({visual_spec_json:{
      ...latest.data.visual_spec_json,layout,compiled:true,lexical,
    }}).match(scope).eq('id',conceptId);
    if(updated.error)throw new Error(updated.error.message);
    return{lexical};
  })();
  pending.set(key,work);
  try{return await work;}finally{pending.delete(key);}
}
