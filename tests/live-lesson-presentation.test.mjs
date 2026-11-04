import test from 'node:test';
import assert from 'node:assert/strict';
import {classroomStatus,conciseLessonPoint,lessonPoints,visibleFlowIndexes} from '../lib/voice/lesson-presentation.ts';
const status={started:false,blocked:false,muted:false,hearing:false,speaking:false,paused:false,state:'LISTENING'};
test('joining never masquerades as listening, even if worker reports ready early',()=>{assert.equal(classroomStatus(status),'Tutor is joining');assert.equal(classroomStatus({...status,hearing:true}),'Tutor is joining');assert.equal(classroomStatus({...status,blocked:true}),'Enable sound');});
test('conversation status follows actual audio and student speech',()=>{assert.equal(classroomStatus({...status,started:true}),'Listening');assert.equal(classroomStatus({...status,started:true,state:'THINKING'}),'Thinking');assert.equal(classroomStatus({...status,started:true,speaking:true,state:'THINKING'}),'Tutor speaking');assert.equal(classroomStatus({...status,started:true,paused:true}),'Lesson paused');});
test('notes remain concise rather than copying long paragraphs',()=>{const text='Inflammation is the body’s protective response to tissue injury which eliminates the initial cause, removes dead cells and initiates tissue repair.';const result=conciseLessonPoint(text);assert.ok(result.split(' ').length<=20);assert.equal(result,'Inflammation is the body’s protective response to tissue injury');assert.ok(!result.includes('…'));assert.equal(lessonPoints('- First important concept\n- Second important concept').length,2);});
test('a flow never exposes future steps or more than three points',()=>{for(let i=0;i<100;i++){const visible=visibleFlowIndexes(i);assert.ok(visible.length<=3);assert.equal(visible.at(-1),i);assert.ok(visible.every(x=>x>=0&&x<=i));}});

test('long voice histories keep strict source policy and the visible model instruction',async()=>{
 const {readFile}=await import('node:fs/promises');const {stripTypeScriptTypes}=await import('node:module');
 const source=await readFile(new URL('../app/api/voice/llm/v1/chat/completions/route.ts',import.meta.url),'utf8');
 const start=source.indexOf('export function selectVoiceContext');const end=source.indexOf('/** Private',start);
 const prepared='type VoiceMessage={role:"system"|"user"|"assistant";content:string};\n'+source.slice(start,end);
 const {selectVoiceContext}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(prepared)).toString('base64'));
 const messages=[{role:'system',content:'Teacher persona'},{role:'system',content:'UPLOADED SOURCE POLICY: use only the file'},{role:'system',content:'CURRENT INTERACTIVE VISUAL: atherosclerosis'},...Array.from({length:10},(_,i)=>({role:'system',content:'Other internal context '+i})),...Array.from({length:30},(_,i)=>({role:i%2?'assistant':'user',content:'Dialogue '+i}))];
 const result=selectVoiceContext(messages);assert.ok(result.some(m=>m.content.startsWith('UPLOADED SOURCE POLICY:')));assert.ok(result.some(m=>m.content.startsWith('CURRENT INTERACTIVE VISUAL:')));assert.equal(result.filter(m=>m.role!=='system').length,14);
});

test('the rendered board shows up to three complete key notes without the full lecture',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {readFile}=await import('node:fs/promises');const ts=await import('typescript');
 globalThis.__boardRendering={...React,jsx:(type,props,key)=>React.createElement(type,{...props,key}),jsxs:(type,props,key)=>React.createElement(type,{...props,key}),lessonPoints,visibleFlowIndexes};
 let source=await readFile(new URL('../components/Whiteboard.tsx',import.meta.url),'utf8');source=source.replace(/^import .*;\n/gm,'');
 let output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 output=output.replace(/^import .*;\n/gm,'');
 const prepared='const {useMemo,useState,lessonPoints,visibleFlowIndexes,jsx:_jsx,jsxs:_jsxs}=globalThis.__boardRendering;\n'+output;
 const {default:Board}=await import('data:text/javascript;base64,'+Buffer.from(prepared).toString('base64'));
 const html=renderToStaticMarkup(React.createElement(Board,{topic:'Inflammation',markdown:'- Earlier related teaching point\n- Neutrophils move toward the injured tissue'}));
 assert.equal((html.match(/aria-current="step"/g)||[]).length,1);assert.ok(html.includes('Neutrophils move toward the injured tissue'));assert.ok(html.includes('Earlier related teaching point'));assert.ok(!html.includes('As the tutor explains'));
 delete globalThis.__boardRendering;
});

test('key notes condense the mechanism without dropping negation or uncertainty',()=>{
 assert.equal(conciseLessonPoint('However, chronic use causes receptor up-regulation, meaning the brain produces more receptors to compensate, which can alter the response.'),'Chronic use → receptor up-regulation');
 assert.equal(conciseLessonPoint('This mechanism does not cause receptor up-regulation.'),'This mechanism does not cause receptor up-regulation');
 assert.equal(conciseLessonPoint('Chronic use may cause receptor changes.'),'Chronic use may cause receptor changes');
 assert.equal(conciseLessonPoint('complex '.repeat(30)),'');
});
