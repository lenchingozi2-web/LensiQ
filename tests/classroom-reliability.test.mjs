import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {parseTeachingPacket,parseVisualCue} from '../lib/live-class/visual-protocol.ts';
import {clinicalTopicLabels} from '../lib/rag/clinical-topic.ts';
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
  clinicalTopicLabels,compileCanonicalConcept,
  chunkFacts:facts=>facts.map(f=>({text:f.text,sourceFile:f.sourceFile,pageNumber:f.pageNumber,documentId:f.documentId}))
 });
 const headings=['Tuberculosis','Morphology','Pneumonia','Morphology'];
 const source=headings.map((heading,i)=>({heading,facts:[{text:`Fact ${i}: not always present; 0.5 mg except in renal failure.`,sourceFile:'Notes.pdf',pageNumber:i+1,documentId:ids[0]}]}));
 const nodes=processSyllabus([{source:'Notes.pdf',sections:source}]);
 assert.deepEqual(nodes.map(n=>n.title),['Tuberculosis','Tuberculosis · Morphology','Pneumonia','Pneumonia · Morphology']);
 assert.deepEqual(nodes.flatMap(n=>n.sourceFacts.map(f=>f.text)),source.flatMap(s=>s.facts.map(f=>f.text)));
 assert.deepEqual(nodes.map(n=>n.citations[0].page_number),[1,2,3,4]);
});
