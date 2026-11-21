/** Keep the board progressive without deleting qualifications from medical notes. */
const words=(s:string):string[]=>s.toLowerCase().replace(/^(?:recap|remember|key point)\s*:\s*/,'').match(/[a-z]+|\d+(?:\.\d+)?/g)||[];
export function progressiveAnchors(previous:string[],next:string[]):string[]{
 const result=[...previous];
 for(const note of next){
   const tokens=words(note),key=tokens.join(' ');
   if(result.some(old=>words(old).join(' ')===key))continue;
   if(/^recap\s*:/i.test(note)&&tokens.every(t=>result.some(old=>words(old).includes(t))))continue;
   result.push(note);
 }
 return result.slice(-5);
}
