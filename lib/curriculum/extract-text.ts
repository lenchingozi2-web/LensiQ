import JSZip from 'jszip';
import {posix} from 'node:path';
import { getLectureFileExtension } from '@/lib/curriculum/file-types';
const MAX_EXTRACTED_CHARACTERS = 8_000_000;
function decodeEntities(value:string){return value.replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,(_,hex,decimal,named)=>hex||decimal?String.fromCodePoint(Math.min(0x10ffff,parseInt(hex||decimal,hex?16:10))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[String(named).toLowerCase()]??''));}
function decodeXml(value:string){return decodeEntities(value.replace(/>\s+</g,'><').replace(/<\/(?:w:p|a:p|w:tr|a:tr)>/g,'\n').replace(/<(?:w:br|a:br|w:cr)\b[^>]*\/?\s*>/g,'\n').replace(/<(?:w:tab)\b[^>]*\/?\s*>/g,'\t').replace(/<\/(?:w:tc|a:tc)>/g,'\t').replace(/<[^>]+>/g,'')).replace(/[^\S\n\t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();}
function clampText(value:string){const clean=value.replace(/\u0000/g,'').replace(/\r\n?/g,'\n').replace(/[^\S\n\t]+/g,' ').replace(/\n{4,}/g,'\n\n').trim();if(clean.length>MAX_EXTRACTED_CHARACTERS)throw new Error('Lecture text exceeds the 8-million-character safe parsing limit. Split the file into smaller parts to preserve every page.');return clean;}
function relationships(xml:string,base:string){const links=new Map<string,string>();for(const match of xml.matchAll(/<Relationship\b[^>]*>/g)){const attrs=Object.fromEntries([...match[0].matchAll(/([\w:]+)=["']([^"']*)["']/g)].map(m=>[m[1],decodeEntities(m[2])]));if(attrs.Id&&attrs.Target&&attrs.TargetMode!=='External')links.set(attrs.Id,attrs.Target.startsWith('/')?attrs.Target.slice(1):posix.normalize(posix.join(posix.dirname(base),attrs.Target)));}return links;}
async function extractOfficeXml(buffer:Buffer,extension:string,strict:boolean){
 const zip=await JSZip.loadAsync(buffer);let bytes=0;
 const read=async(path:string)=>{const file=zip.file(path);if(!file)return '';const text=await file.async('text');bytes+=Buffer.byteLength(text);if(bytes>40_000_000)throw new Error('Lecture text exceeds the safe expanded document limit. Split this file into parts.');return text;};
 const parts:string[]=[];
 if(extension==='docx'){
  parts.push(decodeXml(await read('word/document.xml')));
  for(const path of ['word/footnotes.xml','word/endnotes.xml']){const text=decodeXml(await read(path));if(text)parts.push(`[${path.includes('footnotes')?'Footnotes':'Endnotes'}]\n`+text);}
 }else{
  const presentation=await read('ppt/presentation.xml');const rels=relationships(await read('ppt/_rels/presentation.xml.rels'),'ppt/presentation.xml');
  const ordered=[...presentation.matchAll(/<p:sldId\b[^>]*\br:id=["']([^"']+)["']/g)].map(match=>rels.get(match[1])).filter((path):path is string=>Boolean(path));
  const names=ordered.length?ordered:Object.keys(zip.files).filter(path=>/^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a,b)=>Number(a.match(/slide(\d+)/)?.[1])-Number(b.match(/slide(\d+)/)?.[1]));
  const unreadable:number[]=[];
  for(let i=0;i<names.length;i++){
   const path=names[i];const text=decodeXml(await read(path));
   const slideLinks=relationships(await read(posix.join(posix.dirname(path),'_rels',posix.basename(path)+'.rels')),path);
   const notesPath=[...slideLinks.values()].find(target=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(target));const notes=notesPath?decodeXml(await read(notesPath)):'';
   if(!text&&!notes)unreadable.push(i+1);
   parts.push(`[Slide ${i+1}]\n${text}${notes?'\n[Speaker notes]\n'+notes:''}`);
  }
  if(strict&&unreadable.length)throw new Error('Lecture contains image-only slides without readable text or speaker notes: '+unreadable.join(', ')+'. Add text/OCR before using this as the complete lecture source.');
 }
 return clampText(parts.join('\n\n'));
}
async function extractLegacyWord(buffer:Buffer){const {default:WordExtractor}=await import('word-extractor');const document=await new WordExtractor().extract(buffer);return clampText([document.getBody(),document.getFootnotes(),document.getEndnotes()].filter(Boolean).join('\n\n'));}
type PdfItem={str:string;transform:number[];width?:number;hasEOL?:boolean};
export async function extractLectureText(file:File,options:{requireCompleteText?:boolean}={}){
 const extension=getLectureFileExtension(file.name,file.type);const buffer=Buffer.from(await file.arrayBuffer());
 if(extension==='pdf'){
  const pdfModule=await import('pdf-parse/lib/pdf-parse.js');const pdfParse=(pdfModule.default??pdfModule) as unknown as (buffer:Uint8Array,options:Record<string,unknown>)=>Promise<{text:string;numpages:number;numrender:number}>;
  const unreadable:number[]=[];let pageNumber=0;const rendered=new Set<number>();
  const parsed=await pdfParse(new Uint8Array(buffer),{pagerender:async(page:{pageNumber?:number;getTextContent:(options:Record<string,boolean>)=>Promise<{items:PdfItem[]}>})=>{
   const content=await page.getTextContent({normalizeWhitespace:false,disableCombineTextItems:false});pageNumber++;const actualPage=page.pageNumber??pageNumber;rendered.add(actualPage);let text='',last:PdfItem|undefined;
   for(const item of content.items){if(!item.str)continue;if(last){const newLine=Math.abs(item.transform[5]-last.transform[5])>2;const gap=item.transform[4]-(last.transform[4]+(last.width??0));text+=newLine?'\n':gap>15?'\t':gap>1?' ':'';}text+=item.str;last=item;}
   if(!text.trim())unreadable.push(actualPage);return `[Page ${actualPage}]\n`+text;
  }});
  for(let n=1;n<=parsed.numpages;n++)if(!rendered.has(n))unreadable.push(n);
  if(options.requireCompleteText&&(unreadable.length||parsed.numrender<parsed.numpages))throw new Error('Lecture contains pages without readable text: '+unreadable.join(', ')+'. Use a searchable/OCR PDF so the tutor does not skip those pages.');
  return clampText(parsed.text);
 }
 if(extension==='doc')return extractLegacyWord(buffer);
 if(extension==='docx'||extension==='pptx')return extractOfficeXml(buffer,extension,options.requireCompleteText===true);
 if(extension==='txt'||file.type.toLowerCase().startsWith('text/'))return clampText(buffer.toString('utf8'));
 throw new Error('This file type cannot be parsed yet. Use PDF, DOC, DOCX, PPTX, or plain-text files.');
}
export function chunkExtractedText(text:string,chunkSize=4500){const normalized=clampText(text);const chunks:string[]=[];for(let start=0;start<normalized.length;start+=chunkSize)chunks.push(normalized.slice(start,start+chunkSize));return chunks;}
