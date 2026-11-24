/** Teaching selection only: the original source and citations remain intact. */
const administrative=/\b(?:learning objectives?|learning outcomes?|orientation|course (?:outline|objectives)|table of contents|bibliography|references|acknowledg(?:e)?ments?|lecture objectives?|source attribution|document information)\b/i;
const cover=/^(?:(?:mb(?:bs)?\s+exam(?:ination)?|anatomical pathology|anatomic pathology|chemical pathology|pharmacology|medical microbiology|microbiology|haematology|hematology|immunology)(?:\s*[/&|–-]\s*(?:mb(?:bs)?\s+exam(?:ination)?|rebuilt notes|lecture notes|study notes|revision notes|immunology))*(?:\s+notes)?|rebuilt notes|lecture notes|study notes|revision notes|course notes|medical mastery notes|course revision|university of port harcourt)$/i;
export function isTeachingMetadata(value:string):boolean{
 const text=value.trim().replace(/^#{1,6}\s+/,'').replace(/^[•●▪◦]\s*/,'').replace(/\s*·\s*\d+$/,'').trim();
 return !text||cover.test(text)||/^\d{1,4}$/.test(text)||/^\[?(?:page|slide)\s+\d+\]?$/i.test(text)||
 /^(?:lecture-based study notes|main concepts and examinable details|course revision\b|how to use (?:this|these)|(?:study|revision|reading|examination) instructions?\b|(?:instructions?|guidelines?)\s*:|(?:read|revise|review|study)\s+(?:this|these|the following|the notes|the material|each chapter)|(?:this|these) (?:document|notes|handout|slides) (?:is|are|was|were|contain|cover|has|have|should)|(?:prepared|presented|compiled|written|edited) (?:by|for)\b|(?:department|faculty|college|school) of\b|(?:dr|prof|professor|lecturer|author|instructor|course coordinator)\s*[:.\s]\s*\S|copyright|©|https?:\/\/|\S+@\S+)/i.test(text)||
 /^(?:orientation|learning objectives?|year\s*\d+\s*(?:medicine|medical))$/i.test(text)||
 /^(?!Hepatitis\b|Vitamin\b|Type\b|Class\b|Stage\b|Grade\b|Factor\b|Protein\b)[A-Z][A-Za-z'’-]{2,}[.,\s]+(?:[A-Z]\.?[.,\s]*){1,4}$/.test(text)||
 /^(?=.{3,100}$)[A-Z][A-Za-z'’-]+(?:[., ]+[A-Z][A-Za-z'’-]+){0,3}[,\s]+(?:MBBS|MBChB|FWACP|FMCPath|PhD|FMCP|FRCPath|FWACS)(?:[.,\s]+(?:MBBS|MBChB|FWACP|FMCPath|PhD|FMCP|FRCPath|FWACS))*[.]?$/i.test(text);
}
export function teachingLines(title:string,text:string):string[]{
 if(administrative.test(title)||isTeachingMetadata(title))return[];
 const lines=text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
 const result:string[]=[];
 for(const line of lines){
   if(isTeachingMetadata(line)||line.toLowerCase()===title.toLowerCase())continue;
   // Strip only explicit outline markers, not decimal doses, stages or numbered medical facts.
   const cleaned=line.replace(/^(?:[•●▪◦]\s*|\(?\d{1,3}[.)]\s+(?=[A-Za-z]))/,'').trim();
   if(cleaned&&!isTeachingMetadata(cleaned))result.push(cleaned);
 }
 return result;
}
export function isTeachable(title:string,text:string):boolean{return teachingLines(title,text).some(s=>s.split(/\s+/).length>=4);}
