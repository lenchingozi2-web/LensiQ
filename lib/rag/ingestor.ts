import { extractLectureText } from '@/lib/curriculum/extract-text';
import { getLectureFileExtension, normalizeLectureMimeType } from '@/lib/curriculum/file-types';
import type { CitedAtomicFact } from './deduplicator';
import { isLectureCredit, isDocumentCoverHeading, clinicalSectionCategory, normalizedClinicalHeading } from './clinical-topic';

export type ParsedSection = {
  heading: string;
  module: string;
  topic: string;
  facts: CitedAtomicFact[];
  lectureUnit?: string;
};
export type ParsedDocument = { sections: ParsedSection[]; characters: number; source: string };

function legacyHeadingOf(line: string): string | null {
  const value = line.trim();
  if (value.length < 4 || value.length > 145 || /[.!?]$/.test(value)) return null;
  if (/^#{1,5}\s+/.test(value)) return value.replace(/^#+\s+/, '');
  if (/^(?:\d{1,2}\.){1,3}\s+[A-Z]/.test(value)) return value;
  if (/^[A-Z][A-Z0-9 /,():–-]{5,}$/.test(value) && /[A-Z]/.test(value)) return value;
  return null;
}

function headingOf(line:string):string|null {
  const value=line.trim();
  if(/^#{1,5}\s+\S/.test(value))return normalizedClinicalHeading(value);
  const normalized=normalizedClinicalHeading(value);
  if (/^(?:lecture\s+)?unit\s+\d+\s*(?:[:.\-–—]\s*|\s+)\S/i.test(normalized)) return normalized;
  if(clinicalSectionCategory(normalized))return normalized;
  if(normalized.length<3||normalized.length>100||normalized.split(/\s+/).length>10||/[.!?]$/.test(normalized)||/\t/.test(value))return null;
  if(/^(?:\d{1,3}\.){1,4}\s+[A-Z]/.test(value)&&!/[\d%]|\b(?:is|are|was|were|has|have|may|can|should|must|causes?|includes?)\b/i.test(normalized))return normalized;
  if(/^[A-Z][A-Z0-9 /,():–-]{4,}$/.test(normalized)&&!/[\d%]|\b(?:IS|ARE|WAS|WERE|HAS|HAVE|MAY|CAN|SHOULD|MUST|CAUSES?|INCLUDES?)\b/.test(normalized))return normalized;
  if(/^(?:source|citation|reference)\s*:/i.test(normalized)||/[•●▪◦→]/.test(value))return null;
  const title=normalized.replace(/^\d{1,3}[.)]?\s+/,'');
  const words=title.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’/-]*/gu)||[];
  const sentenceStarts=new Set(['a','an','and','as','because','but','during','each','for','from','how','if','in','it','many','most','one','some','the','these','they','this','those','to','what','when','where','which','while','why']);
  const titleLike=words.length>=2&&words.length<=10&&/^[A-Z\p{Lu}]/u.test(title)&&
    !sentenceStarts.has(words[0]!.toLowerCase())&&
    !/^(?:key points to recall|exam anchors?|conceptual study pathway)\b/i.test(title)&&
    (words.slice(1).some(word=>/^\p{Lu}/u.test(word))||words.length<=4||title.includes(':'));
  if(titleLike)return title;
  return null;
}

export function parseDocumentSections(text: string, documentId: string, fileName: string, legacy=false): ParsedDocument {
  // Rebuilt lecture compilations declare their true unit boundaries in source
  // attribution lines. These are stronger evidence than inferred slide headings.
  const sourceMarker=/^Source\s*:\s*(.+?)\.(?:pptx?|docx?|pdf|txt)\s*\|\s*\d+\s+(?:lecture\s+)?pages?\s+reviewed\s*$/i;
  const rawLines=text.replace(/\r\n?/g,'\n').split('\n');
  if(!legacy&&rawLines.filter(line=>sourceMarker.test(line.trim())).length>=2){
    const sections:ParsedSection[]=[];
    let page:number|null=null, current:ParsedSection|null=null;
    for(const line of rawLines){
      const value=line.trim();
      const boundary=value.match(/^\[(?:Page|Slide)\s+(\d+)\]$/i);
      if(boundary){page=Number(boundary[1]);continue;}
      const marker=value.match(sourceMarker);
      if(marker){
        const title=marker[1].trim().replace(/[_]+/g,' ');
        if(current){
          // The next lecture title is printed just before its attribution.
          const last=current.facts.at(-1);
          if(last?.text.toLowerCase()===title.toLowerCase())current.facts.pop();
          if(current.facts.length)sections.push(current);
        }
        current={heading:title,module:fileName,topic:title,lectureUnit:title,facts:[]};
        continue;
      }
      if(!current||!value||isLectureCredit(value)||isDocumentCoverHeading(value)||
        /^(?:lecture-based study notes\s*[•·]|key points to recall$|exam anchors?\s*:|source\s*:|(?:selected )?visual references?$)/i.test(value)||
        /^\d{1,4}$/.test(value))continue;
      const cleaned=value.replace(/^[•●▪◦]\s*/,'');
      current.facts.push({text:cleaned,documentId,sourceFile:fileName,pageNumber:page});
    }
    if(current?.facts.length)sections.push(current);
    return {sections,characters:text.length,source:fileName};
  }
  const sections: ParsedSection[] = [];
  let page: number | null = null;
  let heading = 'General concepts', moduleTitle = 'General', topic = 'Overview';
  let facts: CitedAtomicFact[] = [];
  let slideStart = false;
  let inSlides = false;
  const flush = () => {
    if (facts.length) sections.push({ heading, module: moduleTitle, topic, facts });
    facts = [];
  };
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (const line of lines) {
    const boundary = line.trim().match(/^\[(?:Page|Slide)\s+(\d+)\]$/i);
    if (boundary) {
      flush(); page = Number(boundary[1]); slideStart = /^\[Slide/i.test(line.trim());
      inSlides = slideStart;
      if (slideStart) heading = 'Slide ' + page;
      continue;
    }
    if (/^\[Slide \d+: Image-only visual slide\]$/i.test(line.trim())) { flush(); continue; }
    if (!line.trim() || line.trim() === '[Speaker notes]') continue;
    if(!legacy&&(isLectureCredit(line)||isDocumentCoverHeading(line))){
      flush();
      const metadata=isLectureCredit(line)?'Source attribution':'Document information';
      sections.push({heading:metadata,module:moduleTitle,topic:metadata,facts:[{text:line.trim(),documentId,sourceFile:fileName,pageNumber:page}]});
      continue;
    }
    const title = !inSlides||slideStart?(legacy?legacyHeadingOf(line):headingOf(line)):null;
    if (slideStart || title) {
      flush(); heading = title || (legacy&&line.trim().length <= 120 ? line.trim() : heading);
      topic = heading; if (!sections.length) moduleTitle = heading;
      slideStart = false;
      if (/^#{1,5}\s+/.test(line.trim()))continue;
    }
    // Every content-bearing line is retained. Original paragraph boundaries remain in chunk text.
    if (line.trim()) facts.push({ text: line.trim(), documentId, sourceFile: fileName, pageNumber: page });
  }
  flush();
  return { sections, characters: text.length, source: fileName };
}

export async function extractUploadedDocumentText(bytes: Uint8Array, fileName: string): Promise<string> {
  const extension = getLectureFileExtension(fileName);
  if (!extension) throw new Error('Unsupported lecture document');
  const file = new File([new Uint8Array(bytes)], fileName, { type: normalizeLectureMimeType(fileName) });
  const extracted = await extractLectureText(file, { requireCompleteText: true });
  if (!extracted.trim()) throw new Error('The document contained no readable content');
  return extracted;
}

export function parseExtractedDocumentText(extracted: string, documentId: string, fileName: string, legacy=false): ParsedDocument {
  if (!extracted.trim()) throw new Error('The document contained no readable content');
  return parseDocumentSections(extracted, documentId, fileName, legacy);
}

export async function parseUploadedDocument(bytes: Uint8Array, documentId: string, fileName: string, legacy=false): Promise<ParsedDocument> {
  return parseExtractedDocumentText(await extractUploadedDocumentText(bytes, fileName), documentId, fileName, legacy);
}

export type AtomicChunk = { text: string; sourceFile: string; pageNumber: number | null; documentId: string };
export function chunkFacts(facts: CitedAtomicFact[], maxCharacters = 1500): AtomicChunk[] {
  const chunks: AtomicChunk[] = [];
  let pending: AtomicChunk | null = null;
  const flush = () => { if (pending) chunks.push(pending); pending = null; };
  for (const fact of facts) {
    const segments:string[]=[];
    let remaining=fact.text;
    while(remaining.length>maxCharacters){
      const window=remaining.slice(0,maxCharacters);
      // Prefer a complete sentence. Never sever a decimal or an adjacent unit if a word boundary exists.
      const endings=[...window.matchAll(/[.!?](?=\s)/gu)];
      const boundary=endings.at(-1)?.index;
      const word=window.search(/\s+\S*$/u);
      let cut=boundary!==undefined&&boundary>=maxCharacters/3?boundary+1:word>0?word:maxCharacters;
      if(/[\uD800-\uDBFF]/.test(remaining[cut-1]))cut--;
      segments.push(remaining.slice(0,cut));
      remaining=remaining.slice(cut).trimStart();
    }
    if(remaining)segments.push(remaining);
    for (const text of segments) {
      if (pending && (pending.documentId !== fact.documentId || pending.pageNumber !== fact.pageNumber || pending.text.length + text.length + 1 > maxCharacters)) flush();
      if (!pending) pending = { text, sourceFile: fact.sourceFile, pageNumber: fact.pageNumber, documentId: fact.documentId };
      else pending.text += '\n' + text;
    }
  }
  flush();
  return chunks;
}
