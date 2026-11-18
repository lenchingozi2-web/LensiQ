import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { purgeRawFilesAfterCompile, purgeSessionMaterialsOnEnd, purgeSyllabusMaterials, sweepExpiredSyllabi } from '@/lib/rag/ephemeral-cleanup';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const UUID=/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
export async function POST(request:Request){
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const admin=createAdminClient();
  if(!admin)return NextResponse.json({error:'Storage cleanup configuration unavailable'},{status:503});
  const body=await request.json().catch(()=>null);
  const action=typeof body?.action==='string'?body.action:'';
  const sessionId=typeof body?.sessionId==='string'?body.sessionId:'';
  const syllabusId=typeof body?.syllabusId==='string'?body.syllabusId:'';
  try{
    if(action==='sweep')return NextResponse.json({ok:true,...await sweepExpiredSyllabi(admin,user.id)});
    if(action==='link'){
      if(!UUID.test(sessionId)||!UUID.test(syllabusId))return NextResponse.json({error:'Invalid class or syllabus ID'},{status:400});
      const {data:session}=await client.from('live_class_sessions').select('id')
        .eq('id',sessionId).eq('user_id',user.id).eq('status','active').maybeSingle();
      if(!session)return NextResponse.json({error:'Active owned session required'},{status:403});
      const {data:linked,error}=await admin.from('study_syllabi')
        .update({session_id:sessionId,expires_at:new Date(Date.now()+90*60*1000).toISOString()})
        .eq('id',syllabusId).eq('user_id',user.id).in('status',['draft','compiling','ready','failed'])
        .is('session_id',null).select('id').maybeSingle();
      if(error||!linked)return NextResponse.json({error:'Could not link an unclaimed syllabus to this session'},{status:409});
      return NextResponse.json({ok:true,syllabusId,sessionId});
    }
    if(action==='end'){
      if(!UUID.test(sessionId))return NextResponse.json({error:'Invalid class ID'},{status:400});
      const {data:session}=await client.from('live_class_sessions').select('id,status')
        .eq('id',sessionId).eq('user_id',user.id).maybeSingle();
      if(!session)return NextResponse.json({error:'Session not found'},{status:404});
      // A user can end an active class through the existing metering endpoint first.
      if(session.status==='active')return NextResponse.json({error:'End the class before purging its sources'},{status:409});
      const items=await purgeSessionMaterialsOnEnd(admin,user.id,sessionId);
      return NextResponse.json({ok:true,items});
    }
    if(action==='purge-syllabus'||action==='purge-raw'){
      if(!UUID.test(syllabusId))return NextResponse.json({error:'Invalid syllabus ID'},{status:400});
      const {data:record}=await client.from('study_syllabi').select('session_id,status')
        .eq('id',syllabusId).eq('user_id',user.id).maybeSingle();
      if(!record)return NextResponse.json({error:'Syllabus not found'},{status:404});
      if(action==='purge-raw')return NextResponse.json({ok:true,deletedFiles:await purgeRawFilesAfterCompile(admin,user.id,syllabusId)});
      if(record.session_id){
        const {data:session}=await client.from('live_class_sessions').select('status')
          .eq('id',record.session_id).eq('user_id',user.id).maybeSingle();
        if(session?.status==='active')return NextResponse.json({error:'End the Live Class first'},{status:409});
      }
      return NextResponse.json({ok:true,result:await purgeSyllabusMaterials(admin,user.id,syllabusId)});
    }
    return NextResponse.json({error:'Unsupported cleanup action'},{status:400});
  }catch(error){
    console.error('Ephemeral class purge needs retry',error instanceof Error?error.message:'unknown');
    return NextResponse.json({error:'Cleanup is incomplete. It will be retried during the next cleanup sweep.'},{status:503});
  }
}
