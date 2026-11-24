/** Deterministic, source-heading-only navigation labels; never generate a diagnosis
 * or rewrite the original evidence. Plain clinical section names inherit the
 * nearest explicit heading in the same document; named headings stand alone. */
const categories: Array<[string, RegExp]> = [
  ['Foundations', /^(?:definition|definitions|overview|introduction|anatomy|normal anatomy|background|epidemiology|incidence|prevalence)$/i],
  ['Classification', /^(?:classification|classifications|types|subtypes|staging|grading)$/i],
  ['Etiology', /^(?:etiology|aetiology|causes|risk factors|causes and risk factors|etiology and risk factors|aetiology and risk factors)$/i],
  ['Pathogenesis', /^(?:pathogenesis|pathophysiology|mechanism|mechanisms|mechanism of disease|mechanism of action)$/i],
  ['Morphology', /^(?:morphology|histology|gross appearance|gross morphology|gross pathology|microscopy|microscopic appearance|histopathology)$/i],
  ['Clinical features', /^(?:clinical features|clinical manifestations|clinical presentation|presentation|symptoms|signs|signs and symptoms)$/i],
  ['Investigations', /^(?:investigations|investigation|diagnosis|diagnostic criteria|laboratory findings|differential diagnosis|imaging)$/i],
  ['Management', /^(?:management|treatment|therapy|therapeutics|prevention|drug treatment|pharmacological management)$/i],
  ['Complications and prognosis', /^(?:complications|prognosis|outcomes|follow.up|sequelae)$/i],
];
/** Credits are retained in the source, but must never become clinical anchors. */
export function isSourceAttributionHeading(value:string):boolean{
  if(/^(?:hepatitis|vitamin|type|class|stage|grade|factor|protein)\b/i.test(value))return false;
  return /^[A-Z][A-Za-z'’-]{2,}\s*[.,]\s*(?:[A-Z]\.?[,\s]*){1,4}$/.test(value.trim())||/^(?:dr\.?|prof(?:essor)?\.?|lecturer|presented by|prepared by|department of|faculty of)\s/i.test(value)||/^[A-Z][A-Z'’-]{2,}[.,\s]+(?:[A-Z]\.?[.,\s]*){1,4}$/.test(value.trim());
}
export function cleanClinicalTitle(value:string):string{
  return value.split(/\s*[·|]\s*/).filter(part=>!isLectureCredit(part)&&!isDocumentCoverHeading(part)&&!/^source attribution$|^document information$/i.test(part)).join(' · ').trim()||'Clinical concept';
}
export function legacyClinicalTopicLabels(headings: readonly string[]): string[] {
  let anchor = '';
  return headings.map((original) => {
    const heading = original.trim() || 'General concepts';
    const normalized = heading.replace(/^(?:\d{1,2}\.){1,3}\s+/, '').replace(/[:：]\s*$/, '').trim();
    if(/^(?:learning objectives?|learning outcomes?|lecture objectives?|orientation|course outline|table of contents|references|bibliography|year\s*\d+\s*(?:medicine|medical).*)$/i.test(normalized))return heading;
    if(isSourceAttributionHeading(normalized))return anchor?anchor+' · Source attribution':'Source attribution';
    const category = categories.find(([, pattern]) => pattern.test(normalized))?.[0];
    if (category) return anchor ? anchor + ' · ' + category : category;
    if (/^(?:slide\s+\d+|general concepts|general|untitled)$/i.test(normalized)) return anchor ? anchor + ' · ' + heading : heading;
    anchor = heading;
    return heading;
  });
}


/** Explicit attribution signals; never infer a person's name from capitals alone. */
export function isLectureCredit(value:string):boolean{
  const text=value.trim().replace(/^#{1,5}\s+/,'');
  return isSourceAttributionHeading(text)||
    /^(?:compiled by|written by|course lecturer|course coordinator|instructor|facilitator|author|edited by)\s*:\s*\S/i.test(text)||
    /^(?:dr|prof|professor|lecturer|instructor|author)\s*[:.]\s*\S/i.test(text)||
    /^By\s+(?:Dr\.?|Prof\.?)\s+\S/i.test(text)||
    /^(?=.{3,100}$)[A-Z][A-Za-z'’-]+(?:[., ]+[A-Z][A-Za-z'’-]+){0,3}[,\s]+(?:MBBS|MBChB|FWACP|FMCPath|PhD|FMCP|FRCPath|FWACS)(?:[.,\s]+(?:MBBS|MBChB|FWACP|FMCPath|PhD|FMCP|FRCPath|FWACS))*[.]?$/i.test(text);
}
export function isDocumentCoverHeading(value:string):boolean{
  const text=value.trim().replace(/^#{1,5}\s+/, '');
  return /^(?:mb(?:bs)?\s+exam(?:ination)?\s*[/&|–-]\s*rebuilt notes|rebuilt notes|lecture-based study notes(?:\s*·.*)?|lecture-based,? concept[- ]organi[sz]ed revision copy|course revision|main concepts and examinable details.*|foundation to clinical application|editing notes?|source lectures?|selected visual references?)$/i.test(text)||/^(?:anatomical pathology|anatomic pathology|chemical pathology|pharmacology|medical microbiology|microbiology|haematology|hematology|immunology)(?:\s*[/&|–-]\s*(?:immunology|haematology|hematology|mb(?:bs)?\s+exam(?:ination)?\s+notes|lecture notes|study notes|revision notes))*$/i.test(text)||
    /^(?:mb(?:bs)?\s+exam(?:ination)?\s+notes|lecture notes|study notes|revision notes|course notes|medical mastery notes|university of port harcourt)$/i.test(text);
}
export function normalizedClinicalHeading(value:string):string{
  return value.trim().replace(/^#{1,5}\s+/,'').replace(/^(?:(?:\d{1,3}\.){1,4}|\d{1,3})\s+/,'').replace(/[:：]\s*$/,'').trim();
}
export function clinicalSectionCategory(value:string):string|undefined{
  return categories.find(([,pattern])=>pattern.test(normalizedClinicalHeading(value)))?.[0];
}
/** Keep the clinical anchor when encountering document furniture or generic subsections. */
export function clinicalTopicLabels(headings: readonly string[]): string[] {
  let anchor='';
  return headings.map(original=>{
    const heading=normalizedClinicalHeading(original)||'General concepts';
    if(isLectureCredit(heading)||/^source attribution$/i.test(heading))return 'Source attribution';
    if(isDocumentCoverHeading(heading)||/^document information$/i.test(heading))return 'Document information';
    if(/^(?:learning objectives?|learning outcomes?|lecture objectives?|orientation|course outline|table of contents|references|bibliography|year\s*\d+\s*(?:medicine|medical).*)$/i.test(heading))return heading;
    const category=clinicalSectionCategory(heading);
    if(category)return anchor?anchor+' · '+category:category;
    if(/^(?:slide\s+\d+|page\s+\d+|general concepts|general|untitled)$/i.test(heading))return anchor||'General concepts';
    anchor=heading;return heading;
  });
}
