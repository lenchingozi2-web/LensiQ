import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyLiveClassGatewayToken } from '@/lib/voice/live-class-gateway-auth';

export const runtime='nodejs';export const dynamic='force-dynamic';
const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
export async function POST(request:Request){
  const body=await request.json().catch(()=>null);
  const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';
  const query=typeof body?.query==='string'?body.query.trim().slice(0,900):'';
  if(!UUID.test(sessionId)||!query)return NextResponse.json({error:'Question and class required'},{status:400});
  const gateway=verifyLiveClassGatewayToken(process.env.LIVEKIT_API_SECRET?.trim()||'',request.headers.get('authorization'));
  const user=gateway?{id:gateway.user}:(await (await createClient()).auth.getUser()).data.user;
  if(!user||(gateway&&gateway.session!==sessionId))return NextResponse.json({error:'Unauthorized'},{status:401});
  const admin=createAdminClient();
  if(!admin)return NextResponse.json({error:'Study database unavailable'},{status:503});
  const {data:session}=await admin.from('live_class_sessions').select('id,room_name')
    .eq('id',sessionId).eq('user_id',user.id).eq('status','active').maybeSingle();
  if(!session||(gateway&&gateway.room!==session.room_name))return NextResponse.json({error:'Active class required'},{status:403});
  const {data:lesson}=await admin.from('live_class_lessons').select('syllabus_id')
    .eq('session_id',sessionId).eq('user_id',user.id).maybeSingle();
  if(!lesson)return NextResponse.json({error:'Lesson syllabus unavailable'},{status:409});
  // The gateway has a server-verified per-session bearer. This RPC is service-role-only,
  // checks the owner and active session in SQL, and performs lexical retrieval without model calls.
  const {data,error}=gateway
    ?await admin.rpc('search_study_chunks_worker',{p_syllabus_id:lesson.syllabus_id,p_query:query,p_user_id:user.id,p_limit:10})
    :await (await createClient()).rpc('search_study_chunks',{p_syllabus_id:lesson.syllabus_id,p_query:query,p_embedding:null,p_limit:10});
  if(error)return NextResponse.json({error:'Cited class retrieval temporarily unavailable'},{status:503});
  const matches=(data||[]).map((row:{id:string;concept_node_id:string;chunk_text:string;source_file:string;page_number:number|null;score:number})=>({
    id:row.id,conceptNodeId:row.concept_node_id,text:row.chunk_text,
    citation:{file_name:row.source_file,page_number:row.page_number},score:row.score,
  }));
  return NextResponse.json({ok:true,query,mode:'lexical-instant',matches});
}
