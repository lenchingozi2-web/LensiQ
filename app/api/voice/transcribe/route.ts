import {checkAccess} from '@/lib/gatekeeper';
import {finishAiRequest,recordAiUsage} from '@/lib/ai/record-usage';
import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 let reservationId:string|undefined;
 try{
  const db=await createClient();const {data:{user}}=await db.auth.getUser();
  if(!user)return NextResponse.json({error:'Sign in to use voice typing.'},{status:401});
  const form=await request.formData();const audio=form.get('audio');
  if(!(audio instanceof File)||audio.size===0||audio.size>4*1024*1024||!/^audio\//.test(audio.type))return NextResponse.json({error:'Upload a short audio recording under 4 MB.'},{status:400});
  const key=process.env.GROQ_API_KEY?.trim();
  if(!key)return NextResponse.json({error:'Voice typing is temporarily unavailable.'},{status:503});
  const access=await checkAccess('teaching');if(!access.allowed)return NextResponse.json({error:access.message},{status:access.status??403});reservationId=access.reservationId;
  const payload=new FormData();payload.set('file',audio,audio.name||'voice.webm');payload.set('model','whisper-large-v3-turbo');payload.set('language','en');payload.set('response_format','verbose_json');payload.set('temperature','0');
  const response=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:payload,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('transcription_unavailable');
  const data=await response.json();const text=typeof data.text==='string'?data.text.trim():'';
  const seconds=Math.max(10,Number(data.duration)||60);
  await recordAiUsage(user.id,'transcription',{provider:'groq',model:'whisper-large-v3-turbo',inputTokens:0,outputTokens:0,cachedTokens:0,thinkingTokens:0,tokenSource:data.duration?'provider':'estimate',estimatedCostUsd:seconds/3600*.04},{reservationId,success:!!text,outcome:text?'completed':'empty'});
  if(!text)return NextResponse.json({error:'No speech was detected. Your credit has been restored.'},{status:422});
  return NextResponse.json({text});
 }catch{await finishAiRequest(reservationId,false);return NextResponse.json({error:'Voice typing is unavailable. Please retry or type your question.'},{status:503});}
}
