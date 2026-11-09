import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {issueLiveClassGatewayToken,verifyLiveClassGatewayToken} from '../lib/voice/live-class-gateway-auth.ts';

const secret='context-auth-test-secret';
const userId='11111111-1111-4111-8111-111111111111';
const sessionId='22222222-2222-4222-8222-222222222222';
const roomName='lensiq-voice-auth-validation';
const body={userId,courseName:'Pathology',query:'Explain inflammation',includePlan:false};
let sequence=0;
async function handler(options={}){
 const filters=[];let databaseCalls=0;
 const active={id:sessionId,user_id:userId,status:'active',room_name:roomName,...options.active};
 const builder={select(){return this;},eq(key,value){filters.push([key,value]);return this;},limit(){return this;},async maybeSingle(){return{data:options.missing||filters.some(([key,value])=>active[key]!==value)?null:active};}};
 globalThis.__voiceContext={createHmac,timingSafeEqual,verifyLiveClassGatewayToken,
  inspectPointedImage:async()=> 'Visible labelled epithelium',
  after:()=>{},recordAiUsage:async()=>{},usageFromPayload:()=>({}),
  NextResponse:{json:(value,init)=>Response.json(value,init)},
  createServiceClient:()=>{databaseCalls++;return{from:()=>builder,rpc:async()=>({data:options.eligible!==false,error:null})};},
  buildTeachingContext:async()=>({knowledgeSources:[],questions:[]})};
 process.env.LIVEKIT_API_SECRET=secret;
 let source=await readFile(new URL('../app/api/voice/context/route.ts',import.meta.url),'utf8');
 source=source.replace(/^import .*\n/gm,'');
 const preamble='const {createHmac,timingSafeEqual,verifyLiveClassGatewayToken,inspectPointedImage,after,recordAiUsage,usageFromPayload,NextResponse,createServiceClient,buildTeachingContext}=globalThis.__voiceContext;\n';
 const routeModule=await import('data:text/javascript;base64,'+Buffer.from(preamble+stripTypeScriptTypes(source)).toString('base64')+'#'+sequence++);
 const token=issueLiveClassGatewayToken(secret,{roomName,sessionId,userId,expiresAt:new Date(Date.now()+60_000).toISOString()});
 return{post:routeModule.POST,token,filters,calls:()=>databaseCalls};
}
const request=(token,value=body)=>new Request('https://lenxiq.local/api/voice/context',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(value)});
test('the lesson brain accepts the same private session credential as the mouth',async()=>{
 const h=await handler();const r=await h.post(request(h.token));assert.equal(r.status,200);
 assert.ok(h.filters.some(([key,value])=>key==='id'&&value===sessionId));
 assert.ok(h.filters.some(([key,value])=>key==='room_name'&&value===roomName));
});
test('another learner cannot be queried with a valid classroom token',async()=>{
 const h=await handler();const r=await h.post(request(h.token,{...body,userId:'33333333-3333-4333-8333-333333333333'}));assert.equal(r.status,401);assert.equal(h.calls(),0);
});
test('an invalid credential never reaches the database or planner',async()=>{
 const h=await handler();const r=await h.post(request(h.token+'wrong'));assert.equal(r.status,401);assert.equal(h.calls(),0);
});
test('a token cannot use a different active room or bypass the current allowance',async()=>{
 for(const options of [{active:{room_name:'lensiq-voice-different-room'}},{missing:true},{eligible:false}]){
  const h=await handler(options);assert.equal((await h.post(request(h.token))).status,403);
 }
});
test('legacy signed workers remain gated during a rolling deployment',async()=>{
 const h=await handler();const token=createHmac('sha256',secret).update(JSON.stringify(body)).digest('hex');
 assert.equal((await h.post(request(token))).status,200);
});

test('image questions require the same active entitled classroom and session credential',async()=>{
 const h=await handler();
 const imageBody={...body,imageSelection:{url:'https://example.test/image.png',x:.2,y:.4}};
 assert.equal((await h.post(request(h.token,imageBody))).status,200);
 const denied=await handler({eligible:false});
 assert.equal((await denied.post(request(denied.token,imageBody))).status,403);
 const legacy=createHmac('sha256',secret).update(JSON.stringify(body)).digest('hex');
 assert.equal((await h.post(request(legacy,imageBody))).status,401);
});
