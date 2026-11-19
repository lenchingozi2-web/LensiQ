import { AgentDispatchClient } from 'livekit-server-sdk';
import { createClient } from '@/lib/supabase/server';
import { verifyLiveClassGatewayToken } from '@/lib/voice/live-class-gateway-auth';
export const maxDuration=30;
export async function POST(request:Request){
  const db=await createClient(),{data:{user}}=await db.auth.getUser();
  if(!user)return Response.json({error:'Sign in first'},{status:401});
  const {sessionId}=await request.json().catch(()=>({}));
  const {data:session}=await db.from('live_class_sessions').select('room_name').eq('id',sessionId).eq('user_id',user.id).eq('status','active').maybeSingle();
  if(!session)return Response.json({error:'Class has ended'},{status:409});
  const secret=process.env.LIVEKIT_API_SECRET?.trim()||'';
  const origin=process.env.LIVEKIT_URL||process.env.LIVEKIT_PUBLIC_URL||'';
  const client=new AgentDispatchClient(origin.replace(/^ws/,'http'),process.env.LIVEKIT_API_KEY,secret);
  try{
    const dispatches=await client.listDispatch(session.room_name);
    const previous=dispatches.find(d=>d.agentName==='lensiq-syllabus-tutor-v2')??dispatches.find(d=>d.agentName==='lensiq-voice-tutor');
    const token=previous&&JSON.parse(previous.metadata).voiceGatewayToken;
    const claims=token&&verifyLiveClassGatewayToken(secret,'Bearer '+token);
    if(!previous||claims?.user!==user.id||claims?.session!==sessionId||claims.room!==session.room_name)
      return Response.json({error:'The room dispatch has expired. End this class and open a new one.'},{status:409});
    // Replace only the owned, signed dispatch. Never reserve another class.
    await client.deleteDispatch(previous.id,session.room_name);
    await client.createDispatch(session.room_name,'lensiq-syllabus-tutor-v2',{metadata:previous.metadata});
    return Response.json({ok:true});
  }catch{return Response.json({error:'Tutor reconnection failed. Please retry.'},{status:503});}
}
