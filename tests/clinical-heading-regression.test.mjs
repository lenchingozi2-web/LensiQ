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

// Source-boundary strings from the actual 353-page rebuilt pathology PDF.
test('all 48 real source boundaries are recognized, including merged and extensionless attributions',()=>{
 const markers=[{"page":5,"marker":"Source: Cellular adaptation.pptx | 57 lecture pages reviewed"},{"page":18,"marker":"Source: Cell death and types.pptx | 55 lecture pages reviewed"},{"page":23,"marker":"Source: Intracellular accumulations and cellular aging.pptx | 33 lecture pages reviewed"},{"page":27,"marker":"Source: pathologic calcification.pptx | 13 lecture pages reviewed"},{"page":31,"marker":"Source: Acute inflammation.pptx | 46 lecture pages reviewed"},{"page":40,"marker":"Source: Inflammation part 2.pptx | 80 lecture pages reviewed"},{"page":54,"marker":"Source: Wound healing and repair..pptx | 44 lecture pages reviewed"},{"page":62,"marker":"Source: Hemodynamic disorders.pptx + Hemodynamic disorders..pptx | 132 lecture pages reviewed"},{"page":83,"marker":"Source: inflammation.docx | 11 lecture pages reviewed"},{"page":89,"marker":"Source: Genetic disorder 2.pptx | 18 lecture pages reviewed"},{"page":93,"marker":"Source: Genetic disorders.pptx | 66 lecture pages reviewed"},{"page":102,"marker":"Source: Immune system disorder 1.pptx | 48 lecture pages reviewed"},{"page":111,"marker":"Source: Immune system disorder 2.pptx | 46 lecture pages reviewed"},{"page":119,"marker":"Source: Immune disorder 2.ppt | 87 lecture pages reviewed"},{"page":132,"marker":"Source: infectious disease.pptx | 43 lecture pages reviewed"},{"page":140,"marker":"Source: diseases of environment nutrition.pptx | 16 lecture pages reviewed"},{"page":144,"marker":"Source: Disease of infancy.pptx | 50 lecture pages reviewed"},{"page":155,"marker":"Source: Vascular disease.pptx | 46 lecture pages reviewed"},{"page":163,"marker":"Source: Hypertension.pptx | 33 lecture pages reviewed"},{"page":168,"marker":"Source: Congenital heart disease.pptx | 49 lecture pages reviewed"},{"page":177,"marker":"Source: Myocardial Disease.pptx | 35 lecture pages reviewed"},{"page":186,"marker":"Source: Heart failure.pptx | 24 lecture pages reviewed"},{"page":191,"marker":"Source: Obstructive airway disease.pptx | 39 lecture pages reviewed"},{"page":197,"marker":"Source: obstructive airway diseases.pptx | 39 lecture pages reviewed"},{"page":203,"marker":"Source: Ashma and intestinal lung disease.pptx | 29 lecture pages reviewed"},{"page":208,"marker":"Source: Pneumonia & PE.pptx | 50 lecture pages reviewed"},{"page":216,"marker":"Source: Pathology of Lung tumour.pptx | 38 lecture pages reviewed"},{"page":225,"marker":"Source: oesophageal disorder.pptx | 31 lecture pages reviewed"},{"page":232,"marker":"Source: Gastritis, PUD, Gastric CA.pptx | 55 lecture pages reviewed"},{"page":239,"marker":"Source: Hirschsprung disease.pptx | 11 lecture pages reviewed"},{"page":241,"marker":"Source: Intestinal disorders | 31 lecture pages reviewed"},{"page":246,"marker":"Source: pathology of colon polyp.pptx | 23 lecture pages reviewed"},{"page":253,"marker":"Source: colon adenocarcinoma.pptx | 13 lecture pages reviewed"},{"page":255,"marker":"Source: Neuroendocrine tumour.pptx | 19 lecture pages reviewed"},{"page":259,"marker":"Source: Gallbladder stone and cholecystitis.pptx | 25 lecture pages reviewed"},{"page":264,"marker":"Source: hepatobiliary pathology.pptx | 59 lecture pages reviewed"},{"page":277,"marker":"Source: RENAL DISORDERS PART 2.pptx | 40 lecture pages reviewed"},{"page":283,"marker":"Source: Glomerulonephritis.pptx | 46 lecture pages reviewed"},{"page":288,"marker":"Source: Cystic disease of the kidney.pptx | 20 lecture pages reviewed"},{"page":293,"marker":"Source: CNS LECTURE.pptx | 40 lecture pages reviewed"},{"page":301,"marker":"Source: CNS, Topic, Haemorrhage, Herniation and Hydrocephalus.pptx | 61 lecture pages reviewed"},{"page":309,"marker":"Source: CNS Infection.pptx | 48 lecture pages reviewed"},{"page":317,"marker":"Source: Uterine fibriod pathology.pptx | 7 lecture pages reviewed"},{"page":318,"marker":"Source: cell cycle and cervical cancer.pdf | 3 lecture pages reviewed"},{"page":319,"marker":"Source: cervical cancer and gestational trophoblastic disease.pptx | 51 lecture pages reviewed"},{"page":328,"marker":"Source: Adrenal medulla and MEN syndrome.pptx | 98 lecture pages reviewed"},{"page":340,"marker":"Source: Lymphoreticular pathology.pptx | 53 lecture pages reviewed"},{"page":349,"marker":"Source: Skin disorders.pptx | 37 lecture pages reviewed"}];
 const input=['[Page 1]','49 distinct files','Course revision map',...markers.flatMap(({page,marker})=>['[Page '+page+']',marker,'Cells undergo pathological injury and respond to tissue damage.'])].join('\n');
 const nodes=processor.processSyllabus([ingestor.parseExtractedDocumentText(input,'doc-1','AnathPathNotes.pdf')]);
 assert.equal(nodes.length,48);
 assert.equal(nodes[0].title,'Cellular adaptation');
 assert.equal(nodes[30].title,'Intestinal disorders');
 assert.equal(nodes[47].title,'Skin disorders');
 assert.ok(nodes.every(n=>!n.notes.includes('Source:')));
});
