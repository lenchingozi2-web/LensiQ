import { extractLectureText } from '@/lib/curriculum/extract-text';
import { getLectureFileExtension, normalizeLectureMimeType } from '@/lib/curriculum/file-types';
import type { CitedAtomicFact } from './deduplicator';

export type ParsedSection = {
  heading: string;
  module: string;
  topic: string;
  facts: CitedAtomicFact[];
};
export type ParsedDocument = { sections: ParsedSection[]; characters: number; source: string };

function headingOf(line: string): string | null {
  const value = line.trim();
  if (value.length < 4 || value.length > 145 || /[.!?]$/.test(value)) return null;
  if (/^#{1,5}\s+/.test(value)) return value.replace(/^#+\s+/, '');
  if (/^(?:\d{1,2}\.){1,3}\s+[A-Z]/.test(value)) return value;
  if (/^[A-Z][A-Z0-9 /,():–-]{5,}$/.test(value) && /[A-Z]/.test(value)) return value;
  return null;
}

export function parseDocumentSections(text: string, documentId: string, fileName: string): ParsedDocument {
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
    const title = !inSlides||slideStart?headingOf(line):null;
    if (slideStart || title) {
      flush(); heading = title || (line.trim().length <= 120 ? line.trim() : heading);
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

export async function parseUploadedDocument(bytes: Uint8Array, documentId: string, fileName: string): Promise<ParsedDocument> {
  const extension = getLectureFileExtension(fileName);
  if (!extension) throw new Error('Unsupported lecture document');
  const file = new File([new Uint8Array(bytes)], fileName, { type: normalizeLectureMimeType(fileName) });
  const extracted = await extractLectureText(file, { requireCompleteText: true });
  if (!extracted.trim()) throw new Error('The document contained no readable content');
  return parseDocumentSections(extracted, documentId, fileName);
}

export type AtomicChunk = { text: string; sourceFile: string; pageNumber: number | null; documentId: string };
export function chunkFacts(facts: CitedAtomicFact[], maxCharacters = 1500): AtomicChunk[] {
  const chunks: AtomicChunk[] = [];
  let pending: AtomicChunk | null = null;
  const flush = () => { if (pending) chunks.push(pending); pending = null; };
  for (const fact of facts) {
    const segments = fact.text.match(new RegExp('[\\s\\S]{1,' + maxCharacters + '}', 'g')) || [];
    for (const text of segments) {
      if (pending && (pending.documentId !== fact.documentId || pending.pageNumber !== fact.pageNumber || pending.text.length + text.length + 1 > maxCharacters)) flush();
      if (!pending) pending = { text, sourceFile: fact.sourceFile, pageNumber: fact.pageNumber, documentId: fact.documentId };
      else pending.text += '\n' + text;
    }
  }
  flush();
  return chunks;
}
