import JSZip from 'jszip';
import { getLectureFileExtension } from '@/lib/curriculum/file-types';

// Preserve large lecture sources for retrieval; never send all pages to the LLM at once.
const MAX_EXTRACTED_CHARACTERS = 8_000_000;

function decodeXml(value: string) {
  return value
    .replace(/<\/(?:w:p|a:p|w:tr|p:sp|w:br|a:br)>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clampText(value: string) {
  const clean = value.replace(/\u0000/g, '').replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ').replace(/\n{4,}/g, '\n\n').trim();
  // Never silently discard final chapters/pages. A large unsupported document
  // must be split by the learner rather than falsely reported as fully loaded.
  if (clean.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error('Lecture text exceeds the 8-million-character safe parsing limit. Split the file into smaller parts to preserve every page.');
  }
  return clean;
}

async function extractOfficeXml(buffer: Buffer, extension: string) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files).filter((name) => {
    if (extension === 'docx') return name === 'word/document.xml' || name.startsWith('word/header') || name.startsWith('word/footer');
    return /^ppt\/slides\/slide\d+\.xml$/.test(name) || /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name);
  });
  const parts = await Promise.all(names.map(async (name) => decodeXml(await zip.files[name].async('text'))));
  return clampText(parts.join('\n'));
}

async function extractLegacyWord(buffer: Buffer) {
  const { default: WordExtractor } = await import('word-extractor');
  const document = await new WordExtractor().extract(buffer);
  return clampText([document.getBody(), document.getFootnotes(), document.getEndnotes()].filter(Boolean).join('\n'));
}

export async function extractLectureText(file: File) {
  const extension = getLectureFileExtension(file.name, file.type);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === 'pdf') {
    const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = (pdfModule.default ?? pdfModule) as (input: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    return clampText(parsed.text);
  }

  if (extension === 'doc') return extractLegacyWord(buffer);
  if (extension === 'docx') return extractOfficeXml(buffer, 'docx');
  if (extension === 'pptx') return extractOfficeXml(buffer, 'pptx');
  if (extension === 'txt' || file.type.toLowerCase().startsWith('text/')) return clampText(buffer.toString('utf8'));

  throw new Error('This file type cannot be parsed yet. Use PDF, DOC, DOCX, PPTX, or plain-text files.');
}

export function chunkExtractedText(text: string, chunkSize = 4500) {
  const normalized = clampText(text);
  const chunks: string[] = [];
  for (let start = 0; start < normalized.length; start += chunkSize) {
    chunks.push(normalized.slice(start, start + chunkSize));
  }
  return chunks;
}
