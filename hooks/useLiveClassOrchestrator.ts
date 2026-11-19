'use client';

import { isSyllabusTutor } from '@/lib/live-class/tutor-identity';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomEvent, type Room, type RemoteParticipant } from 'livekit-client';
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
    const ack=(payload:Uint8Array,participant:RemoteParticipant|undefined,_kind:unknown,topic?:string)=>{
      if(!isSyllabusTutor(participant,sessionId)||topic!=='lk-lesson-state'||payload.byteLength>3000)return;
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
      window.clearTimeout(deadline);window.clearInterval(poll);
      room.off(RoomEvent.DataReceived,ack);
      room.off(RoomEvent.ParticipantConnected,hello);
      if(error)reject(error);else resolve();
    };
    const deadline=window.setTimeout(()=>finish(new Error(
      'The tutor did not acknowledge this room within 10 seconds.',
    )),10000);
    const poll=window.setInterval(hello,900);
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
  const send=useCallback(async(type:string,values:Record<string,unknown>={})=>{
    const room=roomRef.current;
    if(!room)return;
    await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({type,session_id:sessionIdRef.current,...values})),
      {reliable:true,topic:'lk-lesson-state'});
  },[]);
  const begin=useCallback(async(sessionId:string,syllabusId:string|null,room:Room,force=false)=>{
    const key=sessionId+':'+(syllabusId||'waiting');
    if(!force&&beganRef.current===key)return;
    beganRef.current=key;roomRef.current=room;sessionIdRef.current=sessionId;
    sessionStartedRef.current ||= Date.now();
    setStatus('linking');setError('');
    try{
      await waitForTutorWorker(room,sessionId);
      if(beganRef.current!==key)return;
      if(syllabusId)await send('OPEN_LESSON',{syllabus_id:syllabusId,recover:force});
      setStatus('teaching');
    }catch(caught){
      if(beganRef.current!==key)return;
      beganRef.current='';setStatus('error');
      const reason=caught instanceof Error?caught.message:'Tutor handshake failed';
      setError(reason);throw caught;
    }
  },[send]);
  const navigate=useCallback(async(action:Action,conceptNodeId?:string)=>{
    const sessionId=sessionIdRef.current;
    if(!sessionId)throw new Error('No active class');
    const latest=await invoke({action:'state',sessionId});
    const reply=await invoke({action,sessionId,stateVersion:latest.state.state_version,conceptNodeId});
    record(reply);
    await send(action==='pause'?'PAUSE_LESSON':'DELIVER_CURRENT');
    return reply;
  },[send]);
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
    }finally{endingRef.current=false;sessionIdRef.current=null;sessionStartedRef.current=0;beganRef.current='';}
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
