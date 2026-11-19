import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyLiveClassGatewayToken } from '@/lib/voice/live-class-gateway-auth';
import { transitionLessonState, initialLessonState, type LessonState, type LessonEvent } from '@/lib/live-class/orchestrator';
import { makeTeachingPacket, type ConceptRecord } from '@/lib/live-class/teaching-packet';
import { purgeSessionMaterialsOnEnd } from '@/lib/rag/ephemeral-cleanup';

import type { VisualSnapshot } from '@/lib/live-class/visual-protocol';

export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
type LessonRow={session_id:string;syllabus_id:string;user_id:string;phase:LessonState['phase'];state_version:number;
  nodes_json:unknown;cursor:number;current_node_id:string|null;previous_phase:LessonState['previous_phase'];visual_stack_json:unknown};
function toState(row:LessonRow):LessonState{
  return {phase:row.phase,state_version:Number(row.state_version),nodes:Array.isArray(row.nodes_json)?row.nodes_json.filter((v):v is string=>typeof v==='string'):[],
    cursor:row.cursor,current_node_id:row.current_node_id,previous_phase:row.previous_phase};
}
const allowedActions=new Set(['bootstrap','start','next','jump','pause','resume','barge_in','interrupt_done','node_complete','end','state']);
export async function POST(request:Request){
  const body=await request.json().catch(()=>null);
  const action=typeof body?.action==='string'?body.action:'';
  const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';
  if(!allowedActions.has(action)||!UUID.test(sessionId))return NextResponse.json({error:'Invalid lesson action or session'},{status:400});
  const gateway=verifyLiveClassGatewayToken(process.env.LIVEKIT_API_SECRET?.trim()||'',request.headers.get('authorization'));
  const client=await createClient();
  const {data:{user}}=gateway?{data:{user:{id:gateway.user}}}:await client.auth.getUser();
  if(!user || (gateway&&gateway.session!==sessionId))return NextResponse.json({error:'Unauthorized'},{status:401});
  if((action==='node_complete'||action==='interrupt_done')&&!gateway)
    return NextResponse.json({error:'Only the verified tutor worker may acknowledge spoken delivery'},{status:403});
  const admin=createAdminClient();
  if(!admin)return NextResponse.json({error:'Lesson database unavailable'},{status:503});
  const {data:session}=await admin.from('live_class_sessions').select('id,room_name,status')
    .eq('id',sessionId).eq('user_id',user.id).maybeSingle();
  if(!session || (gateway&&session.room_name!==gateway.room))
    return NextResponse.json({error:'No authorized Live Class session'},{status:403});
  if(session.status!=='active' && !['state','end'].includes(action))
    return NextResponse.json({error:'Live Class is no longer active'},{status:409});
  const {data:entitled,error:entitlementError}=await admin.rpc('live_class_gateway_allowed',{p_session:sessionId,p_user:user.id});
  if(entitlementError||entitled!==true)return NextResponse.json({error:'Live Class entitlement unavailable'},{status:403});
  try{
    const {data:existingLesson,error:lookupError}=await admin.from('live_class_lessons').select('*').eq('session_id',sessionId).eq('user_id',user.id).maybeSingle();
    if(lookupError)throw lookupError;
    let lesson=existingLesson;
    async function discover(syllabusId:string){
      const {data:s,error}=await admin!.from('study_syllabi').select('id,status,active_generation,staging_generation')
        .eq('id',syllabusId).eq('user_id',user!.id).eq('session_id',sessionId).in('status',['ready','compiling']).single();
      if(error||!s)throw new Error('Active linked syllabus unavailable');
      const nodes:{id:string;title:string}[]=[];
      const fingerprints=new Set<string>();
      for(let from=0;;from+=500){
        const page=await admin!.from('syllabus_concept_nodes').select('id,title,visual_spec_json->>fingerprint').eq('syllabus_id',s.id)
          .eq('user_id',user!.id).eq('generation',s.staging_generation??s.active_generation).eq('node_type','concept')
          .order('sort_order').order('id').range(from,from+499);
        if(page.error)throw page.error;
        for(const node of page.data){
          // Keep every source chunk searchable. Speak an identical checkpoint only once.
          if(node.fingerprint && fingerprints.has(node.fingerprint)&&node.id!==body.conceptNodeId)continue;
          if(node.fingerprint)fingerprints.add(node.fingerprint);
          nodes.push({id:node.id,title:node.title});
        }
        if(page.data.length<500)break;
      }
      return {nodes,pending:s.status==='compiling'};
    }
    if(action==='bootstrap'){
      if(lesson)return NextResponse.json({ok:true,state:toState(lesson as LessonRow)});
      const syllabusId=typeof body.syllabusId==='string'?body.syllabusId:'';
      if(!UUID.test(syllabusId))return NextResponse.json({error:'Syllabus required'},{status:400});
      const {nodes}=await discover(syllabusId);
      if(!nodes?.length)return NextResponse.json({error:'Compiled concepts missing'},{status:409});
      const prepared=transitionLessonState(initialLessonState(),{type:'SYLLABUS_COMPILED',nodes:nodes.map(n=>n.id)});
      const inserted=await admin.from('live_class_lessons').insert({
        session_id:sessionId,syllabus_id:syllabusId,user_id:user.id,phase:prepared.phase,
        state_version:prepared.state_version,nodes_json:prepared.nodes,cursor:prepared.cursor,
      }).select('*').maybeSingle();
      if(inserted.error){
        // A replacement worker and the original dispatch can briefly overlap.
        // Treat an already-created, same-owner lesson as an idempotent bootstrap.
        if(inserted.error.code!=='23505')throw inserted.error;
        const existing=await admin.from('live_class_lessons').select('*')
          .eq('session_id',sessionId).eq('user_id',user.id).eq('syllabus_id',syllabusId).single();
        if(existing.error||!existing.data)throw inserted.error;
        return NextResponse.json({ok:true,state:toState(existing.data as LessonRow)});
      }
      lesson=inserted.data;
      return NextResponse.json({ok:true,state:toState(lesson as LessonRow),syllabusId,tree:nodes});
    }
    if(!lesson)return NextResponse.json({error:'Initialize syllabus before starting the lesson'},{status:409});
    const record=lesson as LessonRow;
    const current=toState(record);
    async function packetFor(state:LessonState){
      if(state.phase!=='TEACHING_NODE'||!state.current_node_id)return null;
      const {data,error}=await admin!.from('syllabus_concept_nodes')
        .select('id,title,consolidated_notes,key_details_json,source_citations_json,visual_spec_json')
        .eq('id',state.current_node_id).eq('syllabus_id',record.syllabus_id).eq('user_id',user!.id).single();
      if(error||!data)throw new Error('Concept lookup failed');
      return makeTeachingPacket(sessionId,record.syllabus_id,state.state_version,data as ConceptRecord);
    }
    if(action==='state')return NextResponse.json({ok:true,state:current,packet:await packetFor(current)});

    const version=Number(body.stateVersion);
    if(!Number.isSafeInteger(version)||version!==current.state_version)
      return NextResponse.json({error:'Stale lesson state',state:current},{status:409});
    let event:LessonEvent;
    switch(action){
      case 'start':event={type:'START'};break;
      case 'next':event={type:'NEXT_CONCEPT'};break;
      case 'jump':event={type:'JUMP_TO_CONCEPT',concept_node_id:String(body.conceptNodeId||'')};break;
      case 'pause':event={type:'PAUSE'};break;
      case 'resume':event={type:'RESUME'};break;
      case 'end':event={type:'END'};break;
      case 'barge_in': {
        const snapshot=body.visualSnapshot as VisualSnapshot;
        if(!snapshot||!UUID.test(snapshot.concept_node_id)||!Number.isSafeInteger(snapshot.cue_index)
          ||snapshot.cue_index<0||snapshot.cue_index>64||!Array.isArray(snapshot.whiteboard_snapshot))
          return NextResponse.json({error:'Invalid visual interruption snapshot'},{status:400});
        event={type:'STUDENT_BARGE_IN',visual_snapshot:snapshot};break;
      }
      case 'interrupt_done':event={type:'INTERRUPT_ANSWER_COMPLETE'};break;
      case 'node_complete':
        event={type:'NODE_DELIVERY_COMPLETE',state_version:version,
          concept_node_id:String(body.conceptNodeId||''),worker_verified:Boolean(gateway)};break;
      default:return NextResponse.json({error:'Unsupported lesson action'},{status:400});
    }
    if(action==='jump'&&!current.nodes.includes(String(body.conceptNodeId)) ||
       ['node_complete','next'].includes(action)&&current.cursor+1>=current.nodes.length){
      const {nodes,pending}=await discover(record.syllabus_id);
      const known=new Set(current.nodes);
      current.nodes.push(...nodes.filter(n=>!known.has(n.id)).map(n=>n.id));
      if(action!=='jump'&&pending&&current.cursor+1>=current.nodes.length)
        return NextResponse.json({ok:true,waiting:true,state:current});
    }
    const next=transitionLessonState(current,event);
    if(next===current)return NextResponse.json({ok:true,stale:true,state:current});
    const stack=Array.isArray(record.visual_stack_json)?[...record.visual_stack_json]:[];
    if(event.type==='STUDENT_BARGE_IN')stack.push(event.visual_snapshot);
    const restored=event.type==='INTERRUPT_ANSWER_COMPLETE' ? stack.pop() ?? null:null;
    if(event.type==='END')stack.length=0;
    const {data:changed,error:writeError}=await admin.from('live_class_lessons').update({
      phase:next.phase,state_version:next.state_version,nodes_json:next.nodes,cursor:next.cursor,
      current_node_id:next.current_node_id,previous_phase:next.previous_phase,
      visual_stack_json:stack,updated_at:new Date().toISOString(),
    }).eq('session_id',sessionId).eq('user_id',user.id)
      .eq('state_version',current.state_version).select('session_id').maybeSingle();
    if(writeError)throw writeError;
    if(!changed)return NextResponse.json({error:'Concurrent state change; refresh lesson state'},{status:409});
    const upcoming=next.phase==='TEACHING_NODE'?next.nodes[next.cursor+1]:null;
    const [packet,following]=await Promise.all([packetFor(next),upcoming?
      admin.from('syllabus_concept_nodes').select('id,title').eq('id',upcoming).eq('syllabus_id',record.syllabus_id)
        .eq('user_id',user.id).maybeSingle():null]);
    const lookahead=following?.data?{conceptNodeId:following.data.id,title:following.data.title}:null;
    let purge=null;
    if(action==='end'){
      purge=await purgeSessionMaterialsOnEnd(admin,user.id,sessionId);
    }
    return NextResponse.json({ok:true,state:next,packet,lookahead,restoredVisual:restored,purge});
  }catch(error){
    console.error('Live Class orchestration failed',error instanceof Error?error.message:'unknown');
    return NextResponse.json({error:'Unable to complete lesson transition; no classroom state was fabricated'},{status:503});
  }
}
