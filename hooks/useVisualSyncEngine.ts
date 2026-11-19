'use client';

import { useEffect, useRef, useState } from 'react';
import { RoomEvent, type Room, type RemoteParticipant } from 'livekit-client';
import { parseVisualCue, type VisualCue, type Citation } from '@/lib/live-class/visual-protocol';

type VisualSnapshot={active_mode:string;concept_node_id:string;cue_index:number;whiteboard_snapshot:string[];active_cue:VisualCue};
export function useVisualSyncEngine(room:Room|null){
  const [cue,setCue]=useState<VisualCue|null>(null);
  const [cueIndex,setCueIndex]=useState(-1);
  const [conceptId,setConceptId]=useState<string|null>(null);
  const [steps,setSteps]=useState<string[]>([]);
  const [citations,setCitations]=useState<Citation[]>([]);
  const [complete,setComplete]=useState(false);
  const versionRef=useRef(0);
  const lastConceptRef=useRef<string|null>(null);
  useEffect(()=>{
    if(!room)return;
    const receive=(payload:Uint8Array,participant:RemoteParticipant|undefined,kind:unknown,topic?:string)=>{
      void kind; if(!participant?.isAgent)return;
      if(topic!=='lk-lesson-state'||payload.byteLength>15000)return;
      let data:Record<string,unknown>;
      try{data=JSON.parse(new TextDecoder().decode(payload)) as Record<string,unknown>;}catch{return;}
      const version=Number(data.state_version);
      if(!Number.isSafeInteger(version)||version<versionRef.current)return;
      if(data.type==='SYNC_VISUAL_STAGE'){
        try{
          const nextCue=parseVisualCue(data.cue);
          const nextConcept=typeof data.concept_node_id==='string'?data.concept_node_id:'';
          const index=Number(data.cue_index);
          if(!nextConcept||!Number.isSafeInteger(index))return;
          if(version===versionRef.current&&nextConcept===conceptId&&index<cueIndex&&nextCue.mode!=='whiteboard_scratchpad')return;
          versionRef.current=version;
          setConceptId(nextConcept);setCueIndex(index);setCue(nextCue);setCitations(nextCue.citations);
          if(nextConcept!==lastConceptRef.current){
            lastConceptRef.current=nextConcept;setSteps([...nextCue.steps]);
          }else if(nextCue.mode==='whiteboard'){
            setSteps(current=>[...new Set([...current,...nextCue.steps])].slice(-32));
          }
        }catch{return;}
      }else if(data.type==='RESTORE_VISUAL_STATE'){
        const snapshot=data.snapshot as VisualSnapshot|null;
        if(!snapshot||!Array.isArray(snapshot.whiteboard_snapshot))return;
        try{
          setCue(parseVisualCue(snapshot.active_cue));setConceptId(snapshot.concept_node_id);
          setCueIndex(snapshot.cue_index);setSteps(snapshot.whiteboard_snapshot.slice(0,32));
          versionRef.current=version;
        }catch{return;}
      }else if(data.type==='SCRATCHPAD_EVIDENCE'){
        const refs=Array.isArray(data.citations)?data.citations:[];
        setCitations(refs.filter((r):r is Citation=>Boolean(r&&typeof r==='object'&&typeof(r as Citation).file_name==='string')).slice(0,15));
      }else if(data.type==='LESSON_COMPLETED'){
        setComplete(true);versionRef.current=version;
      }
    };
    room.on(RoomEvent.DataReceived,receive);
    return()=>{room.off(RoomEvent.DataReceived,receive);};
  },[room,conceptId,cueIndex]);
  const reset=()=>{setCue(null);setCueIndex(-1);setConceptId(null);setSteps([]);setCitations([]);setComplete(false);versionRef.current=0;lastConceptRef.current=null;};
  return {cue,cueIndex,conceptId,steps,citations,complete,reset};
}
