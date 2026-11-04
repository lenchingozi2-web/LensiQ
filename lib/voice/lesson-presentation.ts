export function conciseLessonPoint(value: string, maxWords = 20): string {
  let core=value.replace(/```[\s\S]*?```/g,' ').replace(/\*\*|__|`/g,'').replace(/^\s*(?:[-*+]|\d+[.)]|#{1,6})\s+/,'').replace(/\s+/g,' ').trim();
  if(/^(?:hello|welcome|what would you like|you can interrupt|imagine |think of )/i.test(core))return '';
  core=core.replace(/^(?:(?:however|now|so|remember|essentially|in short|in other words)[, ]+|let.s (?:look at|consider|think about)\s+)/i,'');
  core=core.split(/[,;]?\s+(?:meaning(?: that)?|which|for example|for instance|in other words|and (?:this|that|helps))\b/i)[0].split(/[;.!?]\s+|\n/)[0].replace(/^[ ,;:.!?]+|[ ,;:.!?]+$/g,'');
  if(!/\b(?:not|never|no|without|may|might|can|could|sometimes|usually|rarely)\b/i.test(core))core=core.replace(/\s+(?:causes?|leads? to|results? in|triggers?)\s+/i,' → ');
  const words=core.split(' ');if(words.length>maxWords||words.length<3)return '';
  return core.charAt(0).toUpperCase()+core.slice(1);
}
export function lessonPoints(markdown: string): string[] {
  return markdown.split(/\n+|(?<=[.!?])\s+/).map(line => conciseLessonPoint(line)).filter(line => line.length > 8).slice(-48);
}
export function visibleFlowIndexes(active: number): number[] {
  return Array.from({length:Math.min(3,active+1)},(_,index)=>Math.max(0,active-2)+index);
}
export function classroomStatus(input:{started:boolean;blocked:boolean;muted:boolean;hearing:boolean;speaking:boolean;paused:boolean;state:string}):string {
  if(input.blocked)return 'Enable sound';
  if(!input.started)return 'Tutor is joining';
  if(input.hearing&&!input.muted)return 'Hearing you';
  if(input.speaking)return 'Tutor speaking';
  if(input.paused)return 'Lesson paused';
  if(input.state==='THINKING'||input.state==='ANSWERING')return 'Thinking';
  if(input.state==='RESUMING')return 'Continuing lesson';
  if(input.state==='INTERRUPTED')return 'Go ahead';
  if(input.state==='ERROR')return 'Needs attention';
  if(input.muted)return 'Mic muted';
  return 'Listening';
}
