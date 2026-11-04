import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
let state;
const originalFetch=globalThis.fetch;
const originalKey=process.env.GEMINI_API_KEY;
const canonical={question_text:'Canonical question',correct_answer:'B',model_answer:'Canonical answer',option_a:'Wrong',option_b:'Right'};
function reset(){state={question:canonical,checks:0,settlements:[],records:[],attempts:0,cache:[],questionError:null};process.env.GEMINI_API_KEY='test-key';}
const client={auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},from(){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:state.question,error:state.questionError})};}};
const service={from(){return {select(){return this;},eq(){return this;},single:async()=>({data:null}),insert:async row=>{state.cache.push(row);return {error:null};}};}};
globalThis.__explanationTest={NextResponse:{json:(body,options={})=>Response.json(body,options)},createClient:async()=>client,createServiceClient:()=>service,checkAccess:async()=>{state.checks++;return {allowed:true,reservationId:'reservation'};},finishAiRequest:async(id,success)=>state.settlements.push({id,success}),recordAiUsage:async(...args)=>state.records.push(args),usageFromPayload:()=>({})};
const source=(await readFile(new URL('../app/api/explain/route.ts',import.meta.url),'utf8')).replace(/^import[\s\S]*?;\n/gm,'');
const {POST}=await import('data:text/javascript;base64,'+Buffer.from('const {NextResponse,createClient,createServiceClient,checkAccess,finishAiRequest,recordAiUsage,usageFromPayload}=globalThis.__explanationTest;\n'+stripTypeScriptTypes(source)).toString('base64'));
const request=()=>new Request('https://example.invalid/api/explain',{method:'POST',body:JSON.stringify({questionId:'question',questionText:'Forged question',options:{A:'Forged option'},correctAnswer:'Forged answer'})});
test.after(()=>{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;delete globalThis.__explanationTest;});
test('unreadable question cannot consume a credit or seed a shared explanation',async()=>{reset();state.question=null;const response=await POST(request());assert.equal(response.status,404);assert.equal(state.checks,0);assert.equal(state.cache.length,0);});
test('explanation uses stored evidence and keeps one credit through a successful retry',async()=>{reset();let prompt='';globalThis.fetch=async(_url,options)=>{state.attempts++;if(state.attempts===1)throw new TypeError('temporary transport failure');prompt=options.body;return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({content:'Explanation',flagged:false})}]}}]});};const response=await POST(request());assert.equal(response.status,200);assert.equal(state.checks,1);assert.equal(state.attempts,2);assert.match(prompt,/Canonical question/);assert.doesNotMatch(prompt,/Forged/);assert.deepEqual(state.settlements,[]);assert.equal(state.records[0][3].reservationId,'reservation');assert.equal(state.cache.length,1);});
test('unavailable provider returns the reserved credit once after retries finish',async()=>{reset();globalThis.fetch=async()=>new Response('',{status:400});assert.equal((await POST(request())).status,503);assert.deepEqual(state.settlements,[{id:'reservation',success:false}]);assert.equal(state.records.length,0);assert.equal(state.cache.length,0);});
