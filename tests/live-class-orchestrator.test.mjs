import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { VisualStateStack, parseTeachingPacket, syncVisualStage } from '../lib/live-class/visual-protocol.ts';
import { LookaheadBuffer } from '../lib/live-class/lookahead-buffer.ts';
import { selectModelForTask, routeSpokenTurn } from '../lib/live-class/model-router.ts';
import { purgeSessionMaterialsOnEnd } from '../lib/rag/ephemeral-cleanup.ts';

const SRC = new URL('../lib/live-class/orchestrator.ts', import.meta.url);
const source = await readFile(SRC, 'utf8');
globalThis.__testVisualProtocol = { VisualStateStack };
const transformed = stripTypeScriptTypes(source.replace(
  /^import \{ VisualStateStack, type VisualSnapshot \} from '\.\/visual-protocol';\s*/m,
  'const { VisualStateStack } = globalThis.__testVisualProtocol;\n',
));
const { initialLessonState, transitionLessonState, LessonOrchestrator } = await import(
  'data:text/javascript;base64,' + Buffer.from(transformed).toString('base64')
);
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
const c='33333333-3333-4333-8333-333333333333';
const cue=(mode,title)=>({id:title,mode,title,spoken_text:'Explain '+title,steps:['Evidence','Interpretation'],citations:[{file_name:'notes.pdf',page_number:3}]});
test('Groq routing matches short barge-in and full teaching models',()=>{
  assert.equal(selectModelForTask('teach').model,'llama-3.3-70b-versatile');
  assert.equal(selectModelForTask('barge_in').model,'llama-3.1-8b-instant');
});
test('Groq rate limit fails over to Gemini Flash with no dropped turn',async()=>{
  let groqCalls=0,geminiCalls=0;
  const fetcher=async(url,init)=>{
    if(String(url).includes('api.groq.com')){groqCalls++;assert.match(init.headers.authorization,/Bearer test-groq/);return {ok:false,status:429};}
    geminiCalls++;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Here is the renal answer.'}]}}]})};
  };
  const chunks=[];
  for await (const chunk of routeSpokenTurn('How does glomerular filtration work?', 'barge_in',{
    env:{GROQ_API_KEY:'test-groq',GEMINI_API_KEY:'test-gemini'},fetcher,firstTokenMs:200,
  }))chunks.push(chunk);
  assert.equal(groqCalls,1);assert.equal(geminiCalls,1);
  assert.equal(chunks.length,1);assert.equal(chunks[0].provider,'gemini');
  assert.match(chunks[0].text,/renal answer/);
});
test('deterministic visual cue order interswitches 3D and returns to the whiteboard',()=>{
  const packet=parseTeachingPacket({type:'TEACHING_PACKET',session_id:a,syllabus_id:b,state_version:5,concept_node_id:c,
    title:'Heart',visual_cues:[cue('whiteboard','Anatomy'),cue('anatomy_3d','Heart chambers'),cue('whiteboard','Summary')]});
  assert.equal(syncVisualStage(packet,0).cue.mode,'whiteboard');
  assert.equal(syncVisualStage(packet,1).cue.mode,'anatomy_3d');
  assert.equal(syncVisualStage(packet,2).cue.mode,'whiteboard');
  assert.throws(()=>syncVisualStage(packet,9),/checkpoint/i);
});
test('barge-in scratchpad pushes exact cue and pops the original visual state',()=>{
  const initial={active_mode:'anatomy_3d',concept_node_id:a,cue_index:1,whiteboard_snapshot:['Causes','Mechanism'],
    active_cue:cue('anatomy_3d','Heart chambers')};
  const v=new VisualStateStack();v.push(initial);
  initial.whiteboard_snapshot.push('MUTATED');
  assert.deepEqual(v.peek().whiteboard_snapshot,['Causes','Mechanism']);
  const restored=v.pop();
  assert.equal(restored.active_mode,'anatomy_3d');assert.equal(restored.cue_index,1);assert.equal(v.depth,0);
});
test('versioned state machine rejects stale worker completion and only advances on verified packets',()=>{
  const syllabus=transitionLessonState(initialLessonState(),{type:'SYLLABUS_COMPILED',nodes:[a,b]});
  assert.equal(syllabus.phase,'SYLLABUS_READY');
  const playing=transitionLessonState(syllabus,{type:'START'});
  assert.equal(playing.state_version,2);assert.equal(playing.current_node_id,a);
  assert.equal(transitionLessonState(playing,{type:'NODE_DELIVERY_COMPLETE',state_version:1,concept_node_id:a,worker_verified:true}),playing);
  assert.equal(transitionLessonState(playing,{type:'NODE_DELIVERY_COMPLETE',state_version:2,concept_node_id:a,worker_verified:false}),playing);
  const next=transitionLessonState(playing,{type:'NODE_DELIVERY_COMPLETE',state_version:2,concept_node_id:a,worker_verified:true});
  assert.equal(next.current_node_id,b);assert.equal(next.state_version,3);
  const finished=transitionLessonState(next,{type:'NODE_DELIVERY_COMPLETE',state_version:3,concept_node_id:b,worker_verified:true});
  assert.equal(finished.phase,'COMPLETED');
});
test('single-source state returns from scratchpad to the exact interrupted concept',()=>{
  const state=transitionLessonState(transitionLessonState(initialLessonState(),{type:'SYLLABUS_COMPILED',nodes:[a]}),{type:'START'});
  const tutor=new LessonOrchestrator(state);
  const visual={active_mode:'whiteboard',concept_node_id:a,cue_index:2,whiteboard_snapshot:['Renal flow'],
    active_cue:cue('whiteboard','Renal flow')};
  assert.equal(tutor.dispatch({type:'STUDENT_BARGE_IN',visual_snapshot:visual}).phase,'HANDLING_INTERRUPT');
  const answer=tutor.restoreAfterAnswer();
  assert.equal(answer.state.phase,'TEACHING_NODE');
  assert.equal(answer.visual.cue_index,2);
  assert.equal(answer.visual.whiteboard_snapshot[0],'Renal flow');
});
test('lookahead warms the next concept once and preserves the cached result',async()=>{
  const calls=[];
  const buffer=new LookaheadBuffer(async id=>{calls.push(id);return {id,text:'prefetched'};});
  const first=await buffer.get(a);const second=await buffer.warm(b);const repeat=await buffer.get(b);
  assert.equal(first.id,a);assert.deepEqual(repeat,second);assert.deepEqual(calls,[a,b]);
});
function mockCleanupClient(failStorage=false){
  const state={
    syllabi:[{id:a,user_id:c,session_id:b,status:'ready',reserved_bytes:123,used_bytes:123,active_generation:1}],
    documents:[{id:'d',user_id:c,syllabus_id:a,storage_path:c+'/'+a+'/'+b+'.pdf'}],
    nodes:[{syllabus_id:a,user_id:c}],chunks:[{syllabus_id:a,user_id:c}],
    removed:[],
  };
  const tableMap={study_syllabi:'syllabi',study_documents:'documents',syllabus_concept_nodes:'nodes',document_atomic_chunks:'chunks'};
  const from=table=>{
    const q={filters:[],kind:'select',values:null,
      select(){return this},eq(key,value){this.filters.push(r=>r[key]===value);return this},
      neq(key,value){this.filters.push(r=>r[key]!==value);return this},
      update(values){this.kind='update';this.values=values;return this},
      delete(){this.kind='delete';return this},
      async maybeSingle(){const rows=state[tableMap[table]].filter(r=>this.filters.every(fn=>fn(r)));return {data:rows[0]||null,error:null}},
      then(resolve,reject){
        let rows=state[tableMap[table]].filter(r=>this.filters.every(fn=>fn(r)));
        if(this.kind==='update')rows.forEach(row=>Object.assign(row,this.values));
        if(this.kind==='delete')state[tableMap[table]]=state[tableMap[table]].filter(r=>!rows.includes(r));
        return Promise.resolve({data:rows,error:null}).then(resolve,reject);
      },
    };
    return q;
  };
  return{state,client:{from,storage:{from:()=>({remove:async(paths)=>{
    if(failStorage)return {error:{message:'Storage offline'}};
    state.removed.push(...paths);return{error:null};
  }})}}};
}
test('class completion permanently wipes raw files, vectors, notes and releases byte quotas',async()=>{
  const {client,state}=mockCleanupClient();
  const result=await purgeSessionMaterialsOnEnd(client,c,b);
  assert.equal(result.length,1);assert.equal(result[0].deletedFiles,1);
  assert.equal(state.removed.length,1);assert.equal(state.chunks.length,0);
  assert.equal(state.nodes.length,0);assert.equal(state.documents.length,0);
  assert.equal(state.syllabi[0].status,'purged');assert.equal(state.syllabi[0].used_bytes,0);
  assert.equal(state.syllabi[0].reserved_bytes,0);
});
test('failed Storage deletion does not falsely clear syllabus quotas or heavy vectors',async()=>{
  const {client,state}=mockCleanupClient(true);
  await assert.rejects(()=>purgeSessionMaterialsOnEnd(client,c,b),/Storage offline/);
  assert.equal(state.syllabi[0].status,'purging');
  assert.equal(state.syllabi[0].used_bytes,123);
  assert.equal(state.chunks.length,1);
});
test('worker and purge SQL schema protect session-scoped lookup and in-flight writes',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20261116183000_live_class_orchestration.sql',import.meta.url),'utf8');
  for(const term of ['live_class_lessons','state_version','guard_syllabus_index_write','search_study_chunks_worker','service_role','status.eq.purging'.split('.').at(0)])
    assert.ok(sql.includes(term),term);
});
