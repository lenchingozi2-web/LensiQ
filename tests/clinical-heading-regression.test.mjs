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
  chunkFacts(facts,maxCharacters=1500){
    const chunks=[];let pending=null;
    const flush=()=>{if(pending)chunks.push(pending);pending=null;};
    for(const fact of facts){
      for(let offset=0;offset<fact.text.length;offset+=maxCharacters){
        const text=fact.text.slice(offset,offset+maxCharacters);
        if(pending&&(pending.documentId!==fact.documentId||pending.pageNumber!==fact.pageNumber||pending.text.length+text.length+1>maxCharacters))flush();
        if(!pending)pending={text,sourceFile:fact.sourceFile,pageNumber:fact.pageNumber,documentId:fact.documentId};
        else pending.text+='\n'+text;
      }
    }
    flush();return chunks;
  },
  compileCanonicalConcept(title,facts){return {title,facts,sourceFacts:facts,notes:facts.map(f=>f.text).join('\n'),citations:[...new Map(facts.map(f=>[`${f.sourceFile}:${f.pageNumber}:${f.documentId}`,{file_name:f.sourceFile,page_number:f.pageNumber,document_id:f.documentId}])).values()]};},
  ...teaching,
};
const ingestorSource=(await read('../lib/rag/ingestor.ts')).replace(/^import .*;\n/gm,'');
const ingestor=await import(dataModule('const {isLectureCredit,isDocumentCoverHeading,clinicalSectionCategory,normalizedClinicalHeading}=globalThis.__clinicalParserTest;\n'+ingestorSource));
const processSource=(await read('../lib/rag/process-syllabus.ts')).replace(/^import .*;\n/gm,'');
const processor=await import(dataModule('const {chunkFacts,compileCanonicalConcept,clinicalTopicLabels,legacyClinicalTopicLabels,isTeachingMetadata,hasClinicalSubstance}=globalThis.__clinicalParserTest;\n'+processSource));
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

test('pathology-note cover and editorial headings are metadata, not classroom concepts',()=>{
  for(const title of ['Editing note','Source lectures','Lecture-based, concept-organised revision copy','Foundation to clinical application']){
    assert.equal(clinical.isDocumentCoverHeading(title),true,title);
    assert.equal(teaching.isTeachingMetadata(title),true,title);
  }
  assert.equal(teaching.isTeachingMetadata('System pathology: heart, lung, gut, kidney, CNS and reproductive organs'),true);
});

test('large deterministic headings retain one concept with bounded retrieval chunks',()=>{
  const facts=Array.from({length:10},(_,index)=>({
    text:`Fact ${index+1}: `+'clinical evidence '.repeat(55),sourceFile:'AnathPathNotes.pdf',pageNumber:index+1,documentId:'doc-1',
  }));
  const concepts=processor.processSyllabus([{source:'AnathPathNotes.pdf',characters:11_000,sections:[{heading:'Cell injury',module:'General',topic:'Overview',facts}]}]);
  assert.deepEqual(concepts.map(concept=>concept.chunks.length),[10]);
  assert.deepEqual(concepts.map(concept=>concept.title),['Cell injury']);
  assert.equal(concepts.flatMap(concept=>concept.chunks).length,10);
  for(const concept of concepts){
    assert.ok(concept.chunks.every(chunk=>chunk.text.length<=1150));
    assert.equal(concept.citations.length,concept.chunks.length);
  }
  const retained=concepts.flatMap(concept=>concept.facts).map(fact=>fact.text).join('\n');
  for(const fact of facts)assert.ok(retained.includes(fact.text));
});

test('bundle front matter is excluded and 49 lecture units retain their ordered source chunks',()=>{
  const source=['[Page 1]','Lecture bundle','49 files total','Each file is a unit','49 files = organized topics','Table of contents'];
  for(let unit=1;unit<=49;unit++){
    source.push('[Page '+(unit+1)+']','Unit '+unit+': Disease topic '+unit,'Cell injury is a response to stress.');
    for(let section=1;section<=19;section++)source.push('Section '+section+' morphology','Tissue damage in unit '+unit+' has feature '+section+'.');
  }
  const parsed=ingestor.parseExtractedDocumentText(source.join('\n'),'doc-1','AnathPathNotes.pdf');
  const concepts=processor.processSyllabus([parsed]);
  assert.equal(concepts.length,49);
  assert.ok(concepts.every(concept=>!/(49 files|each file is a unit|table of contents)/i.test(concept.notes)));
  assert.match(concepts[0].title,/Disease topic 1$/);
  assert.match(concepts[48].notes,/unit 49 has feature 19/);
});

test('rebuilt PDF source attributions define lecture units and skip the clinical-looking contents pages',()=>{
 const input=['[Page 1]','49 distinct files','How to use this book','Study the core definitions and classifications first.',
 '[Page 2]','Course revision map','Cellular stress causes tissue dysfunction.',
 '[Page 3]','Contents','Cellular adaptation . . . . . 5','Cell death and types . . . 18',
 '[Page 5]','General pathology: cellular injury and adaptation','Cellular adaptation','Source: Cellular adaptation.pptx | 57 lecture pages reviewed',
 'Overview','Cells exist in a state of homeostasis.','Classification Of Cellular Adaptation','Hypertrophy and hyperplasia are distinct.',
 '[Page 18]','Cell death and types','Source: Cell death and types.pptx | 25 lecture pages reviewed','Necrosis causes inflammation.'].join('\n');
 const parsed=ingestor.parseExtractedDocumentText(input,'doc-1','AnathPathNotes.pdf');
 const nodes=processor.processSyllabus([parsed]);
 assert.deepEqual(nodes.map(n=>n.title),['Cellular adaptation','Cell death and types']);
 assert.match(nodes[0].notes,/homeostasis/);
 assert.match(nodes[0].notes,/Hypertrophy and hyperplasia/);
 assert.ok(!nodes.some(n=>/Course revision map|49 distinct files|Source:|Cellular stress causes tissue dysfunction/.test(n.notes)));
 assert.match(nodes[1].notes,/Necrosis causes inflammation/);
});
