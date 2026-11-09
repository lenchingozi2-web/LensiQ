import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

const user='11111111-1111-4111-8111-111111111111';
const origin='https://hixvbcrrklyajhkyliay.supabase.co';
let sequence=0;
async function helper(){
 let source=await readFile(new URL('../lib/voice/inspect-pointed-image.ts',import.meta.url),'utf8');
 source=source.replace(/^import .*\n/gm,'');
 return import('data:text/javascript;base64,'+Buffer.from('const after=()=>{}; const recordAiUsage=async()=>{}; const usageFromPayload=()=>({});\n'+stripTypeScriptTypes(source)).toString('base64')+'#'+sequence++);
}
test('pointed images cannot access another learner or arbitrary network locations',async()=>{
 const {approvedQuestionImage}=await helper();
 for(const url of ['https://evil.test/image.png',origin+'/storage/v1/object/sign/ephemeral_class_materials/another-user/photo.png',origin+'/storage/v1/object/public/unrelated/photo.png',origin+'/storage/v1/object/public/medical-models/private.glb',origin+'/storage/v1/object/sign/ephemeral_class_materials/'+user+'/%2e%2e%2fother/image.png']) assert.equal(approvedQuestionImage(url,user),null,url);
 assert.ok(approvedQuestionImage(origin+'/storage/v1/object/public/medical-models/diagram.png',user));
 assert.ok(approvedQuestionImage(origin+'/storage/v1/object/sign/ephemeral_class_materials/'+user+'/image.jpg?token=signed',user));
});
test('vision receives actual image bytes and normalized original-image coordinates',async()=>{
 const {inspectPointedImage}=await helper(); const calls=[]; const original=globalThis.fetch;
 process.env.GEMINI_API_KEY='test-key';
 globalThis.fetch=async(url,init)=>{calls.push({url:String(url),init});return calls.length===1?new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}}):Response.json({candidates:[{content:{parts:[{thought:true,text:'private reasoning'},{text:'The selected label is epithelium.'}]}}]});};
 try {
  const answer=await inspectPointedImage({url:origin+'/storage/v1/object/public/medical-models/diagram.png',x:.25,y:.75},'What is this?',user,new AbortController().signal);
  assert.equal(answer,'The selected label is epithelium.');
  assert.equal(calls[0].init.redirect,'error');
  const parts=JSON.parse(calls[1].init.body).contents[0].parts;
  assert.match(parts[0].text,/25% from the left and 75% from the top/);
  assert.equal(parts[1].inlineData.data,'AQID');
 } finally {globalThis.fetch=original;delete process.env.GEMINI_API_KEY;}
});
test('invalid coordinates and nonimage responses never reach the vision model',async()=>{
 const {inspectPointedImage}=await helper(); const original=globalThis.fetch; let calls=0;
 process.env.GEMINI_API_KEY='test-key';globalThis.fetch=async()=>{calls++;return new Response('<html>',{headers:{'content-type':'text/html'}});};
 const selection={url:origin+'/storage/v1/object/public/medical-models/diagram.png',x:NaN,y:.5};
 try {
  assert.equal(await inspectPointedImage(selection,'What is this?',user,new AbortController().signal),null); assert.equal(calls,0);
  assert.equal(await inspectPointedImage({...selection,x:.5},'What is this?',user,new AbortController().signal),null);assert.equal(calls,1);
 } finally {globalThis.fetch=original;delete process.env.GEMINI_API_KEY;}
});
test('oversized image bodies are cancelled before provider submission',async()=>{
 const {inspectPointedImage}=await helper();const original=globalThis.fetch;let calls=0;
 process.env.GEMINI_API_KEY='test-key';globalThis.fetch=async()=>{calls++;return new Response(new Uint8Array(4_000_001),{headers:{'content-type':'image/png'}});};
 try {assert.equal(await inspectPointedImage({url:origin+'/storage/v1/object/public/medical-models/diagram.png',x:.1,y:.1},'What is this?',user,new AbortController().signal),null);assert.equal(calls,1);} finally {globalThis.fetch=original;delete process.env.GEMINI_API_KEY;}
});
