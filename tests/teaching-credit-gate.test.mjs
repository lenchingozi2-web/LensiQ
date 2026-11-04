import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
let checks=0;
globalThis.__teachingGateTest={
 NextResponse:{json:(body,options={})=>Response.json(body,options)},
 createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'test-user'}}})}}),
 checkAccess:async()=>{checks++;return {allowed:false,status:403,message:'No AI allowance'};},
 includesLiveClass:()=>false,getOrCreateProfile:()=>{throw new Error('Unexpected profile lookup');},
 buildTeachingContext:()=>{throw new Error('Unauthorised context retrieval');},
 buildTeachingSystemPrompt:()=>{throw new Error('Unauthorised provider preparation');},
};
const source=(await readFile(new URL('../app/api/teach/route.ts',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const prepared='const {NextResponse,createClient,checkAccess,includesLiveClass,getOrCreateProfile,buildTeachingContext,buildTeachingSystemPrompt}=globalThis.__teachingGateTest;\n'+stripTypeScriptTypes(source);
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(prepared).toString('base64'));
test.after(()=>delete globalThis.__teachingGateTest);
for(const count of [1,2,3,20])test(`deny exhausted/free teaching with ${count} messages before any LLM work`,async()=>{
 const previous=checks;
 const request=new Request('https://example.invalid/api/teach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseName:'Pharmacology',messages:Array.from({length:count},(_,i)=>({role:i%2?'assistant':'user',content:'Explain the mechanism'}))})});
 const response=await POST(request);
 assert.equal(response.status,403);assert.equal(checks,previous+1);assert.equal((await response.json()).error,'No AI allowance');
});
