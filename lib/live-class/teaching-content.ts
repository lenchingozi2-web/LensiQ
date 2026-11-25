/** Teaching selection only: the original source and citations remain intact. */
const administrative=/\b(?:learning objectives?|learning outcomes?|orientation|course (?:outline|objectives|revision map)|table of contents|conceptual study pathway|key points to recall|exam anchors?|bibliography|references|acknowledg(?:e)?ments?|lecture objectives?|source attribution|document information)\b/i;
const cover=/^(?:(?:mb(?:bs)?\s+exam(?:ination)?|anatomical pathology|anatomic pathology|chemical pathology|pharmacology|medical microbiology|microbiology|haematology|hematology|immunology)(?:\s*[/&|–-]\s*(?:mb(?:bs)?\s+exam(?:ination)?|rebuilt notes|lecture notes|study notes|revision notes|immunology))*(?:\s+notes)?|rebuilt notes|lecture notes|study notes|revision notes|course notes|medical mastery notes|course revision|university of port harcourt)$/i;
export function isTeachingMetadata(value:string):boolean{
 const text=value.trim().replace(/^#{1,6}\s+/,'').replace(/^[•●▪◦]\s*/,'').replace(/\s*·\s*\d+$/,'').trim();
 return !text||cover.test(text)||/^(?:\d+\s+files?\s*(?:total|[=:]\s*organi[sz]ed topics)|total\s*(?:files?\s*[:=]?\s*\d+)|each file (?:is|represents|forms) (?:a|one) unit|(?:lecture|file|document|course)\s+bundle|bundle (?:manifest|summary)|file manifest|table of contents|course outline)(?:\b|$)/i.test(text)||/^(?:editing notes?|source lectures?|selected visual references?|foundation to clinical application|lecture-based,? concept[- ]organi[sz]ed revision copy|system pathology:.*(?:heart|lung|gut|kidney|cns|reproductive organs))$/i.test(text)||/^\d{1,4}$/.test(text)||/^\[?(?:page|slide)\s+\d+\]?$/i.test(text)||
 /^(?:lecture-based study notes|main concepts and examinable details|course revision\b|key points to recall|exam anchors?\b|conceptual study pathway|contents?|how to use (?:this|these)|(?:study|revision|reading|examination) instructions?\b|(?:instructions?|guidelines?)\s*:|(?:read|revise|review|study)\s+(?:this|these|the following|the notes|the material|each chapter)|(?:this|these) (?:document|notes|handout|slides) (?:is|are|was|were|contain|cover|has|have|should)|(?:prepared|presented|compiled|written|edited) (?:by|for)\b|(?:department|faculty|college|school) of\b|(?:dr|prof|professor|lecturer|author|instructor|course coordinator)\s*[:.\s]\s*\S|copyright|©|https?:\/\/|\S+@\S+)/i.test(text)||
 /^(?:orientation|learning objectives?|year\s*\d+\s*(?:medicine|medical))$/i.test(text)||
 /^(?!Hepatitis\b|Vitamin\b|Type\b|Class\b|Stage\b|Grade\b|Factor\b|Protein\b)[A-Z][A-Za-z'’-]{2,}[.,\s]+(?:[A-Z]\.?[.,\s]*){1,4}$/.test(text)||
 /^(?=.{3,100}$)[A-Z][A-Za-z'’-]+(?:[., ]+[A-Z][A-Za-z'’-]+){0,3}[,\s]+(?:MBBS|MBChB|FWACP|FMCPath|PhD|FMCP|FRCPath|FWACS)(?:[.,\s]+(?:MBBS|MBChB|FWACP|FMCPath|PhD|FMCP|FRCPath|FWACS))*[.]?$/i.test(text);
}
export function hasClinicalSubstance(value:string):boolean {
 return /\b(?:cells?|tissues?|organs?|diseases?|syndromes?|injur(?:y|ies)|inflamm\w*|necros\w*|apopto\w*|pathogen\w*|infect\w*|immun\w*|receptors?|enzymes?|drugs?|pharmac\w*|metabol\w*|hormones?|proteins?|blood|vascular|cardia\w*|renal|hepatic|pulmonary|neur\w*|bacter\w*|viruses?|viral|cancer|tumou?rs?|anatom\w*|physiolog\w*|ha?emat\w*|glucose|antibod\w*|antigens?|genes?|DNA|RNA|toxins?|tuberculosis|pneumonia|diabetes|hypertension|asthma|stroke|infarct\w*|anaemia|anemia|clinical|diagnos\w*|treatments?)\b/i.test(value);
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
