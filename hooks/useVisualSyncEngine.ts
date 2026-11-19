'use client';

import { acceptTutorPacket } from '@/lib/live-class/tutor-identity';

import { useEffect, useRef, useState } from 'react';
import { RoomEvent, type Room, type RemoteParticipant } from 'livekit-client';
import { parseTeachingPacket, parseVisualCue, type VisualCue, type Citation } from '@/lib/live-class/visual-protocol';

type VisualSnapshot={active_mode:string;concept_node_id:string;cue_index:number;whiteboard_snapshot:string[];active_cue:VisualCue};
export function useVisualSyncEngine(room:Room|null,sessionId:string|null){
  const [cue,setCue]=useState<VisualCue|null>(null);
  const [cueIndex,setCueIndex]=useState(-1);
  const [conceptId,setConceptId]=useState<string|null>(null);
  const [steps,setSteps]=useState<string[]>([]);
  const [citations,setCitations]=useState<Citation[]>([]);
  const [complete,setComplete]=useState(false);
  const versionRef=useRef(0);
  const lastConceptRef=useRef<string|null>(null);
  const lastIndexRef=useRef(-1);
  useEffect(()=>{
    if(!room)return;
    const receive=(payload:Uint8Array,participant:RemoteParticipant|undefined,kind:unknown,topic?:string)=>{
      void kind; if(!participant?.isAgent)return;
      if(topic!=='lk-lesson-state'||payload.byteLength>15000)return;
      let data:Record<string,unknown>;
      try{data=JSON.parse(new TextDecoder().decode(payload)) as Record<string,unknown>;}catch{return;}
      if(!acceptTutorPacket(participant,sessionId,topic,data))return;
      const version=Number(data.state_version);
      if(!Number.isSafeInteger(version)||version<versionRef.current)return;
      if(data.type==='LESSON_OPENED'){
        try{
          const packet=parseTeachingPacket(data.packet);
          const initial=packet.visual_cues[0];
          const top=Array.isArray(data.visual_stack)?data.visual_stack[0]:null;
          if(!top||top.concept_node_id!==packet.concept_node_id||top.cue_index!==0||top.active_mode!==initial.mode)return;
          versionRef.current=version;lastConceptRef.current=packet.concept_node_id;lastIndexRef.current=0;
          setConceptId(packet.concept_node_id);setCueIndex(0);setCue(initial);setCitations(initial.citations);setSteps(initial.steps);
        }catch{return;}
      }else if(data.type==='SYNC_VISUAL_STAGE'){
        try{
          const nextCue=parseVisualCue(data.cue);
          const nextConcept=typeof data.concept_node_id==='string'?data.concept_node_id:'';
          const index=Number(data.cue_index);
          if(!nextConcept||!Number.isSafeInteger(index))return;
          if(version===versionRef.current&&nextConcept===lastConceptRef.current&&index<lastIndexRef.current&&nextCue.mode!=='whiteboard_scratchpad')return;
          lastIndexRef.current=index;
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
          lastConceptRef.current=snapshot.concept_node_id;lastIndexRef.current=snapshot.cue_index;
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
  },[room,sessionId]);
  const reset=()=>{setCue(null);setCueIndex(-1);setConceptId(null);setSteps([]);setCitations([]);setComplete(false);versionRef.current=0;lastConceptRef.current=null;lastIndexRef.current=-1;};
  return {cue,cueIndex,conceptId,steps,citations,complete,reset};
}
