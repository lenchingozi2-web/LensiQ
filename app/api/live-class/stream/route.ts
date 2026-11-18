import { createAdminClient } from '@/lib/supabase/admin';
import { verifyLiveClassGatewayToken } from '@/lib/voice/live-class-gateway-auth';
import { routeSpokenTurn } from '@/lib/live-class/model-router';

export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request){
  const gateway=verifyLiveClassGatewayToken(process.env.LIVEKIT_API_SECRET?.trim()||'',request.headers.get('authorization'));
  if(!gateway)return Response.json({error:'Verified worker gateway required'},{status:401});
  const body=await request.json().catch(()=>null);
  const packet=typeof body?.packet==='string'?body.packet.slice(0,3500):'';
  const task=body?.task==='barge_in'?'barge_in':'teach';
  if(body?.sessionId!==gateway.session||!packet.trim())return Response.json({error:'Invalid worker speech request'},{status:400});
  const admin=createAdminClient();
  if(!admin)return Response.json({error:'Voice router unavailable'},{status:503});
  const {data:session}=await admin.from('live_class_sessions').select('status,room_name')
    .eq('id',gateway.session).eq('user_id',gateway.user).eq('room_name',gateway.room).maybeSingle();
  if(session?.status!=='active')return Response.json({error:'Class has ended'},{status:403});
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({
    async start(controller){
      const send=(type:string,data:unknown)=>controller.enqueue(encoder.encode('event: '+type+'\ndata: '+JSON.stringify(data)+'\n\n'));
      try{
        for await(const chunk of routeSpokenTurn(packet,task)){
          if(request.signal.aborted)break;
          send('chunk',chunk);
        }
        send('done',{ok:true});
      }catch(error){
        console.error('Worker speech request failed',error instanceof Error?error.message:'unknown');
        send('error',{error:'No text model is available for this spoken checkpoint'});
      }finally{controller.close();}
    },
  });
  return new Response(stream,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform'}});
}
