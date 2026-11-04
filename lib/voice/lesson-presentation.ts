export function conciseLessonPoint(value: string, maxWords = 18): string {
  const text = value.replace(/```[\s\S]*?```/g, ' ').replace(/\*\*|__|`/g, '').replace(/^\s*(?:[-*+]|\d+[.)]|#{1,6})\s+/, '').replace(/\s+/g, ' ').trim();
  const words = text.split(' ');
  return words.slice(0, maxWords).join(' ').replace(/[,;:]$/, '') + (words.length > maxWords ? '…' : '');
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
