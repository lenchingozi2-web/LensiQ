export const SYLLABUS_PROTOCOL='lensiq-syllabus-v2';
export type TutorIdentity={isAgent:boolean;identity:string;attributes:Readonly<Record<string,string>>};
// LiveKit attributes and data packets travel independently. Bind a proven
// server-issued agent participant to the session, even if attributes lag.
const proven=new Map<string,string>();
export function isSyllabusTutor(participant:TutorIdentity|undefined,sessionId:string|null|undefined):boolean {
  return Boolean(sessionId&&participant?.isAgent&&(
    proven.get(sessionId)===participant.identity ||
    (participant.attributes['lensiq.protocol']===SYLLABUS_PROTOCOL&&participant.attributes['lensiq.session']===sessionId)
  ));
}
export function acceptTutorPacket(participant:TutorIdentity|undefined,sessionId:string|null|undefined,topic:string|undefined,data:unknown):boolean {
  if(!sessionId||!participant?.isAgent||topic!=='lk-lesson-state'||!data||typeof data!=='object')return false;
  const packet=data as Record<string,unknown>;
  if(packet.session_id!==sessionId||packet.protocol!==SYLLABUS_PROTOCOL)return false;
  const current=proven.get(sessionId);
  if(current&&current!==participant.identity&&packet.type!=='WORKER_READY')return false;
  if(proven.size>=32&&!proven.has(sessionId))proven.delete(proven.keys().next().value!);
  proven.set(sessionId,participant.identity);
  return true;
}
