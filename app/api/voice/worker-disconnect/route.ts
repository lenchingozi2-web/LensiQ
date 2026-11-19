import { RoomServiceClient } from 'livekit-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyLiveClassGatewayToken } from '@/lib/voice/live-class-gateway-auth';
import { purgeSessionMaterialsOnEnd } from '@/lib/rag/ephemeral-cleanup';

export const maxDuration=30;
export async function POST(req:Request){
  const secret=process.env.LIVEKIT_API_SECRET?.trim()||'';
  const gateway=verifyLiveClassGatewayToken(secret,req.headers.get('authorization'));
  if(!gateway)return Response.json({error:'Invalid session credential'},{status:401});
  const db=createAdminClient();
  if(!db)return Response.json({error:'Storage unavailable'},{status:503});
  const session=await db.from('live_class_sessions').select('id').eq('id',gateway.session)
    .eq('user_id',gateway.user).eq('room_name',gateway.room).maybeSingle();
  if(session.error||!session.data)return Response.json({error:'Unknown class'},{status:403});
  try{
    const host=(process.env.LIVEKIT_URL||process.env.LIVEKIT_PUBLIC_URL||'').replace(/^ws/,'http');
    const service=new RoomServiceClient(host,process.env.LIVEKIT_API_KEY,secret);
    const rooms=await service.listRooms([gateway.room]);
    if(rooms.length){
      const people=await service.listParticipants(gateway.room);
      if(people.some(person=>person.identity===gateway.user))return Response.json({ok:true,connected:true});
    }
    await purgeSessionMaterialsOnEnd(db,gateway.user,gateway.session);
    return Response.json({ok:true});
  }catch{return Response.json({error:'Cleanup pending retry'},{status:503});}
}
