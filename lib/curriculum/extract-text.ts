import JSZip from 'jszip';
const MAX_EXTRACTED_CHARACTERS = 180_000;

function decodeXml(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function clampText(value: string) {
  return value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_EXTRACTED_CHARACTERS);
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

export async function extractLectureText(file: File) {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === 'pdf' || file.type === 'application/pdf') {
    const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = (pdfModule.default ?? pdfModule) as (input: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    return clampText(parsed.text);
  }

  if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractOfficeXml(buffer, 'docx');
  }

  if (extension === 'pptx' || file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return extractOfficeXml(buffer, 'pptx');
  }

  if (file.type.startsWith('text/')) {
    return clampText(buffer.toString('utf8'));
  }

  throw new Error('This file type cannot be parsed for question search yet. Use PDF, PPTX, DOCX, or text files.');
}

export function chunkExtractedText(text: string, chunkSize = 4500) {
  const normalized = clampText(text);
  const chunks: string[] = [];
  for (let start = 0; start < normalized.length; start += chunkSize) {
    chunks.push(normalized.slice(start, start + chunkSize));
  }
  return chunks;
}
