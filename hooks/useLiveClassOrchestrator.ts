'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomEvent, type Room } from 'livekit-client';
import type { LessonState } from '@/lib/live-class/orchestrator';
import type { TeachingPacket } from '@/lib/live-class/visual-protocol';

type Action='next'|'jump'|'pause'|'resume'|'end'|'state';
type LessonReply={ok:boolean;state:LessonState;packet?:TeachingPacket;lookahead?:{conceptNodeId:string;title:string}|null;error?:string};
async function invoke(payload:Record<string,unknown>):Promise<LessonReply>{
  const response=await fetch('/api/live-class/orchestrate',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),cache:'no-store',
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error||'Lesson transition failed');
  return data as LessonReply;
}
/** Wait for an actual session-scoped worker handshake; never silently send a
 * teaching packet to an external worker that cannot consume the new protocol. */
async function waitForTutorWorker(room:Room,sessionId:string):Promise<void>{
  return new Promise<void>((resolve,reject)=>{
    let finished=false;
    const ack=(payload:Uint8Array,_participant:unknown,_kind:unknown,topic?:string)=>{
      if(topic!=='lk-lesson-state'||payload.byteLength>3000)return;
      try{
        const message=JSON.parse(new TextDecoder().decode(payload)) as {type?:string;session_id?:string};
        if(message.type==='WORKER_READY'&&message.session_id===sessionId)finish();
      }catch{return;}
    };
    const hello=()=>{void room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({type:'HELLO',session_id:sessionId})),
      {reliable:true,topic:'lk-lesson-state'},
    ).catch(()=>undefined);};
    const finish=(error?:Error)=>{
      if(finished)return;
      finished=true;
      window.clearTimeout(deadline);
      room.off(RoomEvent.DataReceived,ack);
      room.off(RoomEvent.ParticipantConnected,hello);
      if(error)reject(error);else resolve();
    };
    const deadline=window.setTimeout(()=>finish(new Error(
      'The currently deployed voice worker does not support the syllabus protocol. The existing Live Class remains available.',
    )),12000);
    room.on(RoomEvent.DataReceived,ack);
    room.on(RoomEvent.ParticipantConnected,hello);
    hello();
  });
}
export function useLiveClassOrchestrator(){
  const [state,setState]=useState<LessonState|null>(null);
  const [status,setStatus]=useState<'idle'|'linking'|'teaching'|'cleaning'|'complete'|'error'>('idle');
  const [error,setError]=useState('');
  const [nextHint,setNextHint]=useState('');
  const roomRef=useRef<Room|null>(null);
  const sessionIdRef=useRef<string|null>(null);
  const stateRef=useRef<LessonState|null>(null);
  const beganRef=useRef('');
  const sessionStartedRef=useRef(0);
  const endingRef=useRef(false);
  const record=(reply:LessonReply)=>{stateRef.current=reply.state;setState(reply.state);
    if(reply.lookahead?.title)setNextHint(reply.lookahead.title);
    if(reply.state.phase==='COMPLETED')setStatus('complete');
  };
  const publishPacket=useCallback(async(packet?:TeachingPacket)=>{
    if(!packet||!roomRef.current)return;
    const bytes=new TextEncoder().encode(JSON.stringify(packet));
    if(bytes.byteLength>15000)throw new Error('Teaching cue packet exceeds the LiveKit data channel limit');
    await roomRef.current.localParticipant.publishData(bytes,{reliable:true,topic:'lk-lesson-state'});
  },[]);
  const begin=useCallback(async(sessionId:string,syllabusId:string,room:Room)=>{
    if(beganRef.current===sessionId+':'+syllabusId)return;
    beganRef.current=sessionId+':'+syllabusId;
    roomRef.current=room;sessionIdRef.current=sessionId;
    setStatus('linking');setError('');
    try{
      const link=await fetch('/api/rag/cleanup',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'link',sessionId,syllabusId})});
      if(!link.ok)throw new Error((await link.json().catch(()=>null))?.error||'Cannot link class sources');
      const bootstrap=await invoke({action:'bootstrap',sessionId,syllabusId});
      record(bootstrap);
      await waitForTutorWorker(room,sessionId);
      let teaching=bootstrap;
      if(bootstrap.state.phase==='SYLLABUS_READY')teaching=await invoke({
        action:'start',sessionId,stateVersion:bootstrap.state.state_version,
      });
      record(teaching);
      await publishPacket(teaching.packet);
      sessionStartedRef.current=Date.now();
      setStatus('teaching');
    }catch(caught){
      beganRef.current='';setStatus('error');
      const message=caught instanceof Error?caught.message:'Unable to initialize the syllabus tutor';
      setError(message);throw caught;
    }
  },[publishPacket]);
  const navigate=useCallback(async(action:Action,conceptNodeId?:string)=>{
    const id=sessionIdRef.current,old=stateRef.current;
    if(!id||!old)throw new Error('No active syllabus lesson');
    const response=await invoke({action,sessionId:id,stateVersion:old.state_version,conceptNodeId});
    record(response);
    await publishPacket(response.packet);
    return response;
  },[publishPacket]);
  const finalize=useCallback(async()=>{
    const id=sessionIdRef.current;
    if(!id||endingRef.current)return;
    endingRef.current=true;setStatus('cleaning');
    try{
      const result=await fetch('/api/rag/cleanup',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'end',sessionId:id}),keepalive:true});
      if(!result.ok)throw new Error('Session materials are queued for retry');
      setStatus('complete');
    }catch(caught){
      setStatus('error');setError(caught instanceof Error?caught.message:'Cleanup requires retry');
    }finally{endingRef.current=false;}
  },[]);
  useEffect(()=>{
    const endOnExit=()=>{
      const id=sessionIdRef.current;
      if(!id||!sessionStartedRef.current||endingRef.current)return;
      const elapsed=Math.min(5400,Math.floor((Date.now()-sessionStartedRef.current)/1000));
      const payload=new Blob([JSON.stringify({sessionId:id,action:'end',durationSeconds:elapsed})],{type:'application/json'});
      navigator.sendBeacon?.('/api/voice/session',payload);
    };
    window.addEventListener('pagehide',endOnExit);
    return()=>{window.removeEventListener('pagehide',endOnExit);endOnExit();};
  },[]);
  const reset=useCallback(()=>{
    stateRef.current=null;sessionIdRef.current=null;sessionStartedRef.current=0;roomRef.current=null;
    beganRef.current='';setState(null);setStatus('idle');setError('');setNextHint('');
  },[]);
  return {state,status,error,nextHint,begin,navigate,finalize,reset};
}
