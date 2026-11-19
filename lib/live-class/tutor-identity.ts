/** Only the syllabus worker for this room may drive audio and the concept board. */
export const SYLLABUS_PROTOCOL='lensiq-syllabus-v2';
export type TutorIdentity={isAgent:boolean;attributes:Readonly<Record<string,string>>};
export function isSyllabusTutor(participant:TutorIdentity|undefined,sessionId:string|null|undefined):boolean {
  return Boolean(sessionId&&participant?.isAgent&&participant.attributes['lensiq.protocol']===SYLLABUS_PROTOCOL
    &&participant.attributes['lensiq.session']===sessionId);
}
