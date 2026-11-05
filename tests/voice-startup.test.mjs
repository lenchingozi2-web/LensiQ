import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {issueLiveClassGatewayToken,verifyLiveClassGatewayToken} from '../lib/voice/live-class-gateway-auth.ts';

let sequence=0;
async function handler({paid=true,failDispatch=false}={}) {
  const calls=[];
  const sessionId='22222222-2222-4222-8222-222222222222';
  const user={id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.test'};
  const db={auth:{getUser:async()=>({data:{user}})},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{role:'student',plan:paid?'scholar':'free'}})}),rpc:async(name)=>{
    calls.push(name);
    return name==='reserve_live_class_session'?{data:{allowed:true,session_id:sessionId,max_duration_seconds:5400},error:null}:{error:null};
  }};
  globalThis.__voiceStartup={issueLiveClassGatewayToken,NextResponse:{json:Response.json},createClient:async()=>db,createAdminClient:()=>db,logAuthRequestRejection:()=>{},includesLiveClass:plan=>plan==='scholar',LIVE_CLASS_MODEL_ASSETS:{},LIVE_CLASS_MOLECULE_ASSETS:{},
    AccessToken:class {addGrant(){}async toJwt(){return 'synthetic-token';}},
    AgentDispatchClient:class {async createDispatch(room,agent,options){calls.push({room,agent,metadata:JSON.parse(options.metadata)});if(failDispatch)throw new Error('test dispatch failed');}}
  };
  process.env.LIVEKIT_URL='wss://fixture.livekit.cloud';delete process.env.LIVEKIT_PUBLIC_URL;
  process.env.LIVEKIT_API_KEY='fixture-key';process.env.LIVEKIT_API_SECRET='fixture-secret';
  let source=await readFile(new URL('../app/api/voice/token/route.ts',import.meta.url),'utf8');
  source=source.replace(/^import .*\n/gm,'');
  const names=Object.keys(globalThis.__voiceStartup).join(',');
  const module=await import('data:text/javascript;base64,'+Buffer.from('const {'+names+'}=globalThis.__voiceStartup;\n'+stripTypeScriptTypes(source)).toString('base64')+'#'+sequence++);
  return {calls,post:()=>module.POST(new Request('https://fixture.test/api/voice/token',{method:'POST',body:JSON.stringify({courseName:'Pathology'})}))};
}

test('one authenticated dispatch starts a reserved class without an extra room probe',async()=>{
  const h=await handler();const response=await h.post();assert.equal(response.status,200);
  const events=h.calls.filter(x=>typeof x==='object');assert.equal(events.length,1);
  const body=await response.json();assert.equal(body.url,'wss://fixture.livekit.cloud');
  assert.ok(h.calls.indexOf('reserve_live_class_session')<h.calls.indexOf(events[0]));
  const claims=verifyLiveClassGatewayToken('fixture-secret','Bearer '+events[0].metadata.voiceGatewayToken);
  assert.equal(claims.session,body.sessionId);assert.equal(claims.room,body.roomName);
});
test('a failed dispatch releases the reserved classroom',async()=>{
  const h=await handler({failDispatch:true});assert.equal((await h.post()).status,503);
  assert.equal(h.calls.filter(x=>x==='charge_live_class_session').length,1);
});
test('faster startup cannot bypass paid classroom access',async()=>{
  const h=await handler({paid:false});assert.equal((await h.post()).status,403);
  assert.deepEqual(h.calls,['refresh_my_subscription']);
});
