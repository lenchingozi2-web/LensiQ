import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {parseTeachingPacket,parseVisualCue} from '../lib/live-class/visual-protocol.ts';
import {clinicalTopicLabels,legacyClinicalTopicLabels,isLectureCredit,isDocumentCoverHeading,clinicalSectionCategory,normalizedClinicalHeading} from '../lib/rag/clinical-topic.ts';
import {isTeachable,isTeachingMetadata} from '../lib/live-class/teaching-content.ts';
import {compileCanonicalConcept} from '../lib/rag/deduplicator.ts';

const load=async(path,deps)=>{
 const source=(await readFile(new URL(path,import.meta.url),'utf8')).replace(/^import .*\n/gm,'');
 const key='__classroom_'+Math.random().toString(36).slice(2);
 globalThis[key]=deps;
 const mod=await import('data:text/javascript;base64,'+Buffer.from(`const {${Object.keys(deps).join(',')}}=globalThis['${key}'];\n`+stripTypeScriptTypes(source)).toString('base64'));
 delete globalThis[key];return mod;
};
const {makeTeachingPacket}=await load('../lib/live-class/teaching-packet.ts',{parseTeachingPacket,parseVisualCue});
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const make=(mode,facts)=>makeTeachingPacket(ids[0],ids[1],2,{id:ids[2],title:'Renal clearance',key_details_json:facts.map(text=>({text,sourceFile:'Lecture.pdf',pageNumber:8})),source_citations_json:[],visual_spec_json:{mode,structure_id:'renal_clearance'}});

test('a single source checkpoint still stages its relevant interactive model',()=>{
 const packet=make('physiology_sim',['Clearance = urine concentration × urine flow / plasma concentration.']);
 assert.equal(packet.visual_cues.length,1);
 assert.equal(packet.visual_cues[0].mode,'physiology_sim');
 assert.equal(packet.visual_cues[0].structure_id,'renal_clearance');
 assert.deepEqual(packet.visual_cues[0].citations,[{file_name:'Lecture.pdf',page_number:8}]);
});
test('multi-beat teaching retains every numeric qualification and returns to notes',()=>{
 const facts=['Dose is 5 mg, except in severe renal impairment.','May reduce clearance; does not always cause toxicity.','Avoid use if eGFR is below 15 mL/min.','The final examination exception must survive.'];
 const packet=make('physiology_sim',facts);
 assert.equal(packet.visual_cues[0].mode,'physiology_sim');
 assert.equal(packet.visual_cues[1].mode,'whiteboard');
 assert.equal(packet.visual_cues.flatMap(c=>c.spoken_text.split('\n')).join('\n'),facts.join('\n'));
});
test('compiled concepts keep the disease context and all source passages',async()=>{
 const {processSyllabus}=await load('../lib/rag/process-syllabus.ts',{
  clinicalTopicLabels,isTeachingMetadata,compileCanonicalConcept,
  chunkFacts:facts=>facts.map(f=>({text:f.text,sourceFile:f.sourceFile,pageNumber:f.pageNumber,documentId:f.documentId}))
 });
 const headings=['Tuberculosis','Morphology','Pneumonia','Morphology'];
 const source=headings.map((heading,i)=>({heading,facts:[{text:`Fact ${i}: not always present; 0.5 mg except in renal failure.`,sourceFile:'Notes.pdf',pageNumber:i+1,documentId:ids[0]}]}));
 const nodes=processSyllabus([{source:'Notes.pdf',sections:source}]);
 assert.deepEqual(nodes.map(n=>n.title),['Tuberculosis','Tuberculosis · Morphology','Pneumonia','Pneumonia · Morphology']);
 assert.deepEqual(nodes.flatMap(n=>n.sourceFacts.map(f=>f.text)),source.flatMap(s=>s.facts.map(f=>f.text)));
 assert.deepEqual(nodes.map(n=>n.citations[0].page_number),[1,2,3,4]);
});

test('textbook disease concepts retain all atomic chunks without creating four-chunk fragments',async()=>{
 const {processSyllabus}=await load('../lib/rag/process-syllabus.ts',{
  clinicalTopicLabels,isTeachingMetadata,compileCanonicalConcept,
  chunkFacts:facts=>facts.map((fact,index)=>({text:fact.text,sourceFile:fact.sourceFile,pageNumber:fact.pageNumber,documentId:fact.documentId,index}))
 });
 const facts=Array.from({length:24},(_,index)=>({text:`Evidence ${index} remains intact.`,sourceFile:'Textbook.pdf',pageNumber:index+1,documentId:ids[0]}));
 const sections=Array.from({length:12},(_,index)=>({heading:index%2?'Morphology':'Tuberculosis',facts:facts.slice(index*2,index*2+2)}));
 const nodes=processSyllabus([{source:'Textbook.pdf',characters:400_000,sections}]);
 assert.equal(nodes.length,1);
 assert.equal(nodes[0].chunks.length,24);
 assert.equal(nodes[0].sourceFacts.length,24);
});

test('generic headings can stage relevant models using substantive lecture context',async()=>{
 const {matchCuratedClassVisual}=await load('../lib/live-class/model-matcher.ts',{
  LIVE_CLASS_MODEL_CATALOG:[{topics:['prostate anatomy'],modelUrl:'https://fixture.test/prostate.glb',title:'Reference prostate',source:'Verified reference anatomy'}],LIVE_CLASS_MOLECULE_CATALOG:[]
 });
 assert.equal(matchCuratedClassVisual('Foundations','Prostatic enlargement alters the outflow tract.').mode,'anatomy_3d');
 assert.equal(matchCuratedClassVisual('Elimination','Renal excretion removes this drug.').structure_id,'renal_clearance');
 assert.equal(matchCuratedClassVisual('Risk factors','Age over 50 and male predominance.'),null);
});


test('compiled exam PDFs keep credits and title-page furniture out of teachable topics while preserving source facts',async()=>{
 const {parseDocumentSections,chunkFacts}=await load('../lib/rag/ingestor.ts',{isLectureCredit,isDocumentCoverHeading,clinicalSectionCategory,normalizedClinicalHeading});
 const {processSyllabus}=await load('../lib/rag/process-syllabus.ts',{clinicalTopicLabels,legacyClinicalTopicLabels,isTeachingMetadata,compileCanonicalConcept,chunkFacts});
 const source='[Page 1]\nANATOMICAL PATHOLOGY / MB EXAM NOTES\nDr. Jane Example\nACUTE INFLAMMATION\nDefinition\nAcute inflammation is a protective tissue response.\n[Page 2]\nANATOMICAL PATHOLOGY / MB EXAM NOTES\nMorphology\nNeutrophils move into injured tissue.\n1. Neutrophils are recruited in early inflammation.\nDose is 0.5 mg only in this example.\n[Page 3]\nDr. Jane Example\nClinical features\nRedness and swelling occur.\nPNEUMONIA\nMorphology\nAlveolar spaces contain inflammatory cells.';
 const parsed=parseDocumentSections(source,ids[0],'Notes.pdf');
 const nodes=processSyllabus([parsed]);
 const visible=nodes.filter(n=>isTeachable(n.title,n.notes));
 assert.deepEqual(visible.map(n=>n.topic),['ACUTE INFLAMMATION','ACUTE INFLAMMATION','ACUTE INFLAMMATION','PNEUMONIA']);
 assert.deepEqual(visible.map(n=>n.title),['ACUTE INFLAMMATION · Foundations','ACUTE INFLAMMATION · Morphology','ACUTE INFLAMMATION · Clinical features','PNEUMONIA · Morphology']);
 assert.ok(parsed.sections.some(section=>section.heading==='Source attribution'&&section.facts.some(fact=>fact.text.includes('Dr. Jane Example'))));
 assert.ok(parsed.sections.some(section=>section.heading==='Document information'));
 assert.ok(!nodes.some(n=>n.title==='Source attribution'||n.title==='Document information'));
 assert.ok(visible[1].notes.includes('0.5 mg'));
 assert.ok(visible[1].notes.includes('1. Neutrophils are recruited'));
 assert.equal(visible[1].citations[0].page_number,2);
 assert.equal(isLectureCredit('Hepatitis B'),false);
 assert.equal(isLectureCredit('By increasing vascular permeability'),false);
});

test('cover of rebuilt exam notes and document instructions never become a spoken lesson',()=>{
 assert.equal(isTeachable('MB EXAMINATION / REBUILT NOTES · 1','Lecture-based study notes · Main concepts and examinable details\n2 Course revision'),false);
 assert.equal(isTeachable('General concepts','Dr. Jane Example\nLecture-based study notes · Main concepts and examinable details\nCourse revision'),false);
 assert.equal(isTeachable('Acute inflammation','Neutrophils migrate into injured tissue.'),true);
});
