import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

const dataModule=source=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64');
const read=relative=>readFile(new URL(relative,import.meta.url),'utf8');
const clinical=await import(dataModule(await read('../lib/rag/clinical-topic.ts')));
const teaching=await import(dataModule(await read('../lib/live-class/teaching-content.ts')));
globalThis.__clinicalParserTest={
  ...clinical,
  getLectureFileExtension:()=>'.pdf',
  normalizeLectureMimeType:()=> 'application/pdf',
  extractLectureText:async()=>'',
  chunkFacts(facts){
    if(!facts.length)return [];
    return [{text:facts.map(f=>f.text).join('\n'),sourceFile:facts[0].sourceFile,pageNumber:facts[0].pageNumber,documentId:facts[0].documentId}];
  },
  compileCanonicalConcept(title,facts){return {title,facts,sourceFacts:facts,notes:facts.map(f=>f.text).join('\n'),citations:[]};},
  ...teaching,
};
const ingestorSource=(await read('../lib/rag/ingestor.ts')).replace(/^import .*;\n/gm,'');
const ingestor=await import(dataModule('const {isLectureCredit,isDocumentCoverHeading,clinicalSectionCategory,normalizedClinicalHeading}=globalThis.__clinicalParserTest;\n'+ingestorSource));
const processSource=(await read('../lib/rag/process-syllabus.ts')).replace(/^import .*;\n/gm,'');
const processor=await import(dataModule('const {chunkFacts,compileCanonicalConcept,clinicalTopicLabels,legacyClinicalTopicLabels,isTeachingMetadata}=globalThis.__clinicalParserTest;\n'+processSource));
test.after(()=>delete globalThis.__clinicalParserTest);

test('title-style pathology headings are parsed as separate teachable concepts, while document furniture is excluded',()=>{
  const source=[
    '[Page 1]',
    'ANATOMICAL PATHOLOGY',
    'Course revision map',
    'Use this outline to revise the chapters below.',
    'Dr. Ngozi Sample, MBBS',
    'General pathology: cellular injury and adaptation',
    'Cell injury is a reversible or irreversible response to stress.',
    'Cellular adaptation',
    'Hypertrophy is an increase in the size of individual cells.',
    'Key points to recall',
    'Hyperplasia is an increase in the number of cells.',
  ].join('\n');
  const parsed=ingestor.parseExtractedDocumentText(source,'doc-1','AnathPathNotes.pdf');
  assert.ok(parsed.sections.some(section=>section.heading==='General pathology: cellular injury and adaptation'));
  assert.ok(parsed.sections.some(section=>section.heading==='Cellular adaptation'));
  assert.ok(parsed.sections.some(section=>section.heading==='Document information'));
  assert.ok(parsed.sections.some(section=>section.heading==='Source attribution'));
  const concepts=processor.processSyllabus([parsed]);
  assert.deepEqual(concepts.map(concept=>concept.title),[
    'General pathology: cellular injury and adaptation',
    'Cellular adaptation',
  ]);
  assert.ok(concepts[1].notes.includes('Hyperplasia is an increase in the number of cells.'));
  assert.ok(concepts.every(concept=>!/(?:ANATOMICAL PATHOLOGY|Course revision map|Dr\. Ngozi Sample|Key points to recall)/i.test(concept.notes)));
});

test('numbered clinical headings and common etiology subsections normalize consistently',()=>{
  assert.equal(clinical.normalizedClinicalHeading('01 Cellular adaptation'),'Cellular adaptation');
  assert.equal(clinical.clinicalSectionCategory('Causes and risk factors'),'Etiology');
});
