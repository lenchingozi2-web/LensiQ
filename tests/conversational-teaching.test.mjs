import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {teachingLines,isTeachable} from '../lib/live-class/teaching-content.ts';
import {clinicalTopicLabels} from '../lib/rag/clinical-topic.ts';
import {parseTeachingPacket} from '../lib/live-class/visual-protocol.ts';
const load=async(path,deps)=>{
 const source=(await readFile(new URL(path,import.meta.url),'utf8')).replace(/^import .*\n/gm,'');
 const key='__teach'+Math.random().toString(36).slice(2);globalThis[key]=deps;
 const mod=await import('data:text/javascript;base64,'+Buffer.from(`const {${Object.keys(deps).join(',')}}=globalThis['${key}'];\n`+stripTypeScriptTypes(source)).toString('base64'));
 delete globalThis[key];return mod;
};
const {validateAuthoredLesson,authorTeachingPacket,cachedLesson,generateTeachingJson,teachingSchema}=await load('../lib/live-class/lesson-author.ts',{createHash,teachingLines,parseTeachingPacket,matchCuratedClassVisual:()=>({mode:'physiology_sim',structure_id:'renal_clearance'})});
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const record={id:ids[2],title:'Renal elimination',consolidated_notes:'Dose is 5 mg.\nAvoid use below eGFR 15 mL/min.',key_details_json:[],visual_spec_json:{},source_citations_json:[{file_name:'Renal.pdf',page_number:9}]};
const lesson={title:'When kidneys clear less medicine',beats:[
 {speech:'Think of kidney clearance as the speed at which the blood is cleaned of a medicine. Here the prescribed amount is 5 mg. A lower clearance means that the same amount can stay around for longer, so the concentration can build up.',notes:['Less clearance → more accumulation'],fact_ids:[0],use_model:true,activity:'Move the flow slider to see clearance change.'},
 {speech:'Now connect that mechanism to a safety decision: avoid this medicine when eGFR falls below 15 mL/min. That threshold is specific to this source; we should not generalize it to every medicine. The key is to link kidney function to the risk of accumulation.',notes:['eGFR <15 mL/min: avoid this medicine'],fact_ids:[1],use_model:false,activity:''}
]};
test('orientation and page furniture stay out of teaching; medical source remains untouched',()=>{
 const source='ORIENTATION\nYEAR 4 MEDICINE\n2\nNeutrophils move into inflamed tissue.';
 assert.equal(isTeachable('Learning objectives',source),false);
 assert.deepEqual(teachingLines('Acute inflammation',source),['Neutrophils move into inflamed tissue.']);
 assert.ok(source.includes('YEAR 4'));
 assert.deepEqual(clinicalTopicLabels(['Learning objectives','ORIENTATION','Definition','Colorectal polyps','Morphology']),['Learning objectives','ORIENTATION','Foundations','Colorectal polyps','Colorectal polyps · Morphology']);
});
test('authored explanations protect source coverage, dosage, units, and qualifications',()=>{
 assert.equal(validateAuthoredLesson(lesson,record).beats.length,2);
 const missing=structuredClone(lesson);missing.beats[1].fact_ids=[];
 assert.throws(()=>validateAuthoredLesson(missing,record),/detail/);
 const dose=structuredClone(lesson);dose.beats[0].speech=dose.beats[0].speech.replace('5 mg','a low amount');
 assert.throws(()=>validateAuthoredLesson(dose,record),/number/);
 const unit=structuredClone(lesson);unit.beats[0].speech=unit.beats[0].speech.replace('5 mg','5 g');
 assert.throws(()=>validateAuthoredLesson(unit,record),/quantity or unit/);
 const neg=structuredClone(lesson);neg.beats[1].speech='Use this medicine when eGFR falls below 15 mL/min. This threshold guides the decision about renal clearance and safety.';
 assert.throws(()=>validateAuthoredLesson(neg,record),/qualification/);
});
test('source recitation is rejected even with invented fact coverage',()=>{
 const text='The vascular response starts with a short period of vasoconstriction and then prolonged vasodilation. Endothelial gaps permit fluid and plasma proteins to leave the circulation, causing swelling in the affected tissues.';
 const raw={title:'Inflammation',beats:[0,1].map(()=>({speech:text,notes:['Vascular response'],fact_ids:[0]}))};
 assert.throws(()=>validateAuthoredLesson(raw,{...record,consolidated_notes:text}),/recite/);
});
test('validated packets show a relevant interactive visual, concise anchors, then return to board',async()=>{
 const packet=await authorTeachingPacket(ids[0],ids[1],2,record,{env:{GEMINI_API_KEY:'fixture'},fetcher:async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(lesson)}]}}]}),{status:200})});
 assert.equal(packet.teaching_version,3);
 assert.deepEqual(packet.visual_cues.map(c=>c.mode),['physiology_sim','whiteboard']);
 assert.equal(packet.visual_cues[0].steps[0],'Less clearance → more accumulation');
 assert.ok(!packet.visual_cues[0].steps.includes(record.consolidated_notes));
 const cached={...record,visual_spec_json:{authored:cachedLesson(packet,record)}};
 const again=await authorTeachingPacket(ids[0],ids[1],3,cached,{env:{},fetcher:()=>assert.fail('Cache hit must not call model')});
 assert.equal(again.state_version,3);
 assert.deepEqual(again.visual_cues.map(c=>c.spoken_text),packet.visual_cues.map(c=>c.spoken_text),'Repeated question/state reads must not append duplicate manipulation prompts');
});
test('a selected bank question must be identified in the actual teaching plan',()=>{
 const q={id:'bank-1',question:'Why does clearance matter?',answer:'Reduced elimination causes accumulation.'};
 assert.throws(()=>validateAuthoredLesson(lesson,record,q),/practice question/);
 const authored=structuredClone(lesson);authored.bank_question_id=q.id;authored.beats[1].speech+=' Why does the blood level rise? Less medicine is being eliminated.';
 assert.equal(validateAuthoredLesson(authored,record,q).beats.length,2);
});
test('bank choices resolve to the actual answer, never a lone answer letter',async()=>{
 const {relatedBankQuestion}=await load('../lib/live-class/bank-question.ts',{});
 const db={rpc:async()=>({data:[{id:'q',question_text:'Most likely cause?',correct_answer:'B',option_b:'Reduced renal clearance',relevance:2}]})};
 assert.equal((await relatedBankQuestion(db,'Pharmacology','Clearance')).answer,'Reduced renal clearance');
});
test('no-upload course teaching works even when system bank has no matching evidence',async()=>{
 let called=false;
 const {buildCourseLesson}=await load('../lib/live-class/course-lesson.ts',{generateTeachingJson:async(instruction,input)=>{
   called=true;assert.deepEqual(input.bank_questions,[]);
   return{sections:Array.from({length:6},(_,i)=>({title:'Mechanism '+i,content:'An established medical explanation that links the underlying physiology to the clinical presentation and gives the learner a coherent account. '.repeat(3)}))};
 }});
 const text=await buildCourseLesson('Anatomical Pathology','Inflammation',{knowledgeSources:[],questions:[]});
 assert.ok(called);assert.equal((text.match(/^# /gm)||[]).length,6);
});

test('lesson planner uses supported current model and thinking parameters',async()=>{
 await generateTeachingJson('JSON only',{}, {env:{GEMINI_API_KEY:'fixture'},fetcher:async(url,init)=>{
   assert.ok(url.includes('gemini-3.8-flash'));const body=JSON.parse(init.body);
   assert.deepEqual(body.generationConfig.thinkingConfig,{thinkingLevel:'LOW'});
   assert.equal(body.generationConfig.temperature,undefined);
   return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{}'}]}}]}));
 }});
 let calls=0;
 await generateTeachingJson('JSON only',{}, {env:{GEMINI_API_KEY:'fixture',GROQ_API_KEY:'fixture'},fetcher:async(url,init)=>{
   if(++calls===1)return new Response(null,{status:429});
   const body=JSON.parse(init.body);assert.equal(body.model,'qwen/qwen3.8-27b');assert.equal(body.reasoning_effort,'none');assert.equal(body.include_reasoning,false);
   return new Response(JSON.stringify({choices:[{message:{content:'{}'}}]}));
 }});
 assert.equal(calls,2);
});

test('outage and rate limit select a different model with bounded tokens and a constrained lesson format',async()=>{
 const calls=[];
 const result=await generateTeachingJson('JSON lesson',{}, {env:{GEMINI_API_KEY:'fixture',GROQ_API_KEY:'fixture'},schema:teachingSchema(),fetcher:async(url,init)=>{
  const body=JSON.parse(init.body);calls.push({url,body});
  if(calls.length===1)return new Response(null,{status:503});
  if(calls.length===2)return new Response(null,{status:429});
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]}));
 }});
 assert.equal(result.ok,true);assert.equal(calls.length,3);
 assert.ok(calls[2].url.includes('gemini-3.6-flash'));
 assert.equal(calls[0].body.generationConfig.maxOutputTokens,1900);
 assert.equal(calls[1].body.response_format.json_schema.strict,true);
 assert.equal(calls[1].body.response_format.json_schema.schema.properties.beats.maxItems,5);
 assert.equal(calls[1].body.max_completion_tokens,1900);
});
