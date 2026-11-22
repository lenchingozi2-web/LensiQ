import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomInt} from 'node:crypto';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {createElement,useState} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {getPaidPlan,PUBLIC_PAID_PLANS} from '../lib/plans.ts';
const require=createRequire(import.meta.url);
import {subscriptionsEnabled} from '../lib/subscriptions.ts';

async function load(path,bindings={}) {
  bindings={require,...bindings};
  const source=(await readFile(new URL('../'+path,import.meta.url),'utf8')).replace(/^import[\s\S]*?;\r?\n/gm,'');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};new Function('exports',...Object.keys(bindings),js)(exports,...Object.values(bindings));return exports;
}
async function flag(value,run){
  const previous=process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED;
  if(value===undefined)delete process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED;else process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED=value;
  try{return await run();}finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED;else process.env.NEXT_PUBLIC_SUBSCRIPTIONS_ENABLED=previous;}
}
// An owner-aware in-memory PostgREST fixture. It records all predicates and
// mutations, so the behavior tests can detect crossed owners or wallet writes.
function database(seed={}) {
  const tables=structuredClone(seed),calls=[];let sequence=0;
  const db={tables,calls,auth:{getUser:async()=>({data:{user:{id:'alice'}}})},
    rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:true,error:null};},
    from(table){
      let verb='read',payload,filters=[],orders=[],start=0,end=Infinity,maximum=Infinity,one=false;
      const q={
        select(){return q;},insert(row){verb='insert';payload=row;return q;},update(row){verb='update';payload=row;return q;},
        eq(k,v){filters.push([k,'eq',v]);return q;},neq(k,v){filters.push([k,'neq',v]);return q;},
        is(k,v){filters.push([k,'is',v]);return q;},gt(k,v){filters.push([k,'gt',v]);return q;},
        in(k,v){filters.push([k,'in',v]);return q;},ilike(k,v){filters.push([k,'ilike',v]);return q;},
        or(v){filters.push(['','or',v]);return q;},order(k,options={ascending:true}){orders.push([k,options.ascending]);return q;},
        limit(n){maximum=n;return q;},range(a,b){start=a;end=b;return q;},
        single(){one=true;return q;},maybeSingle(){one=true;return q;},
        then(resolve,reject){return Promise.resolve().then(()=>{
          calls.push({table,verb,filters:structuredClone(filters),payload:structuredClone(payload)});
          tables[table]??=[];
          if(verb==='insert')tables[table].push({id:`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,started_at:new Date().toISOString(),status:'active',submitted_at:null,...payload});
          let rows=tables[table].filter(row=>filters.every(([k,op,v])=>{
            if(op==='eq'||op==='is')return row[k]===v;
            if(op==='neq')return row[k]!==v;
            if(op==='gt')return row[k]>v;
            if(op==='in')return v.includes(row[k]);
            if(op==='ilike')return String(row[k]).toLowerCase()===v.toLowerCase();
            if(op==='or'){const [,date,id]=v.match(/^started_at\.lt\.(.*),and\(started_at\.eq\..*,id\.lt\.(.*)\)$/);return row.started_at<date||(row.started_at===date&&row.id<id);}
            throw new Error('Unhandled filter '+op);
          }));
          for(const [k,asc]of orders.slice().reverse())rows=rows.toSorted((a,b)=>(a[k]<b[k]?-1:a[k]>b[k]?1:0)*(asc?1:-1));
          rows=rows.slice(start,Math.min(end+1,start+maximum));
          if(verb==='update')for(const row of rows)Object.assign(row,payload);
          if(verb==='insert')rows=rows.filter(row=>row.id===tables[table].at(-1).id);
          return {data:one?rows[0]??null:rows,error:null};
        }).then(resolve,reject);},
      };return q;
    },
  };return db;
}
const runtime=await load('lib/subscription-runtime.ts',{subscriptionsEnabled,createAdminClient:()=>service});
let service;
const now=()=>new Date().toISOString();
const current=(id='own',owner='alice')=>({id,user_id:owner,started_at:now(),status:'active',room_name:'lensiq-open-'+id});
const noBilling=db=>assert.equal(db.calls.some(c=>c.rpc||['profiles','billing_events','subscriptions','payments'].includes(c.table)),false);

test('only exact true enables subscriptions; missing, false and malformed values stay paused',async()=>{
  for(const value of [undefined,'false','TRUE','1',' true ',''])await flag(value,()=>assert.equal(subscriptionsEnabled(),false));
  await flag('true',()=>assert.equal(subscriptionsEnabled(),true));
});
test('paused data access requires a verified user and server configuration; enabled mode keeps RLS client',async()=>{
  const client=database();service=database();
  await flag('false',()=>{assert.equal(runtime.authenticatedStudyClient(client,{id:'alice'}),service);assert.throws(()=>runtime.authenticatedStudyClient(client,{id:''}));service=null;assert.throws(()=>runtime.authenticatedStudyClient(client,{id:'alice'}));});
  await flag('true',()=>assert.equal(runtime.authenticatedStudyClient(client,{id:'alice'}),client));
});
test('private Storage paths reject foreign owners, traversal, encoded separators and backslashes',()=>{
  assert.equal(runtime.ownedStoragePath('alice','alice/library/lecture.pdf'),true);
  for(const path of ['bob/library/a.pdf','alice/../bob/a.pdf','alice/%2e%2e/bob','alice/a\\b','alice//file','alice/a?token=x'])assert.equal(runtime.ownedStoragePath('alice',path),false);
});
test('the session clock fails closed at 90 minutes, on corrupt dates and future starts',()=>{
  const t=Date.now();assert.equal(runtime.classSessionIsCurrent(new Date(t-5399_000).toISOString(),t),true);
  for(const start of [new Date(t-5400_000).toISOString(),new Date(t+60_000).toISOString(),'invalid'])assert.equal(runtime.classSessionIsCurrent(start,t),false);
});
test('paused gateway access skips paid RPC but retains the session clock and active state',()=>flag('false',async()=>{
  const db=database();assert.equal(await runtime.classGatewayAllowed(db,current(),'alice'),true);
  assert.equal(await runtime.classGatewayAllowed(db,{...current(),status:'ended'},'alice'),false);
  assert.equal(await runtime.classGatewayAllowed(db,{...current(),started_at:new Date(Date.now()-5400_000).toISOString()},'alice'),false);
  noBilling(db);
}));
test('enabled gateway access enforces paid RPC and refuses retroactive billing of paused rooms',()=>flag('true',async()=>{
  const db=database();assert.equal(await runtime.classGatewayAllowed(db,current(),'alice'),false);assert.equal(db.calls.length,0);
  const row={...current(),room_name:'lensiq-voice-metered'};
  assert.equal(await runtime.classGatewayAllowed(db,row,'alice'),true);
  db.rpc=async()=>({data:false,error:null});assert.equal(await runtime.classGatewayAllowed(db,row,'alice'),false);
}));
test('class reservation creates a real owned session, supersedes only older owned rows, and never debits a wallet',()=>flag('false',async()=>{
  const old={...current('old'),started_at:new Date(Date.now()-60_000).toISOString()};
  const db=database({live_class_sessions:[old,current('foreign','bob')],teaching_conversations:[{id:'conversation',user_id:'alice',session_type:'live_class',deleted_at:null}]});
  const result=await runtime.reserveOpenClass(db,'alice','lensiq-open-new','Pathology','conversation');
  assert.equal(result.data.allowed,true);assert.equal(result.data.max_duration_seconds,5400);assert.equal(result.data.is_unlimited,true);
  assert.equal(db.tables.live_class_sessions.find(r=>r.id==='old').status,'ended');
  assert.equal(db.tables.live_class_sessions.find(r=>r.id==='foreign').status,'active');
  assert.equal(db.tables.live_class_sessions.at(-1).user_id,'alice');noBilling(db);
}));
test('class reservation cannot link another learner’s conversation',()=>flag('false',async()=>{
  const db=database({teaching_conversations:[{id:'foreign',user_id:'bob',session_type:'live_class',deleted_at:null}]});
  assert.equal((await runtime.reserveOpenClass(db,'alice','lensiq-open-new','Pathology','foreign')).data,null);
  assert.equal(db.calls.some(c=>c.verb==='insert'),false);
}));
test('an overlapping newer reservation wins without being closed by the older request',()=>flag('false',async()=>{
  const db=database({live_class_sessions:[{...current('concurrent'),started_at:new Date(Date.now()+1000).toISOString()}]});
  const result=await runtime.reserveOpenClass(db,'alice','lensiq-open-race','Pathology',null);
  assert.equal(result.data.allowed,false);assert.equal(result.data.reason,'active_session');
  assert.equal(db.tables.live_class_sessions.find(r=>r.id==='concurrent').status,'active');
  assert.equal(db.tables.live_class_sessions.at(-1).status,'ended');noBilling(db);
}));
test('heartbeats and end preserve ownership, save real state and charge zero minutes',()=>flag('false',async()=>{
  const db=database({live_class_sessions:[current(),current('foreign','bob')]});
  assert.equal((await runtime.updateOpenClass(db,'alice','foreign',false)).data.reason,'session_not_found');
  assert.equal((await runtime.updateOpenClass(db,'alice','own',false)).data.should_end,false);
  assert.ok(db.tables.live_class_sessions[0].last_heartbeat_at);
  const ended=await runtime.updateOpenClass(db,'alice','own',true);assert.equal(ended.data.should_end,true);assert.equal(ended.data.charged_minutes,0);
  assert.equal(db.tables.live_class_sessions[1].status,'active');noBilling(db);
}));
test('expired and newly reenabled open classes close without charging',async()=>{
  const db=database({live_class_sessions:[{...current(),started_at:new Date(Date.now()-5401_000).toISOString()}]});
  await flag('false',async()=>assert.equal((await runtime.updateOpenClass(db,'alice','own',false)).data.reason,'session_time_limit'));
  db.tables.live_class_sessions=[current()];
  await flag('true',async()=>assert.equal((await runtime.updateOpenClass(db,'alice','own',false)).data.reason,'subscriptions_resumed'));noBilling(db);
});
const mock=await load('lib/open-timed-mock.ts',{randomInt,subscriptionsEnabled});
test('paused mocks persist an attempt across the complete paginated bank without changing plan counters',()=>flag('false',async()=>{
  const questions=Array.from({length:1005},(_,i)=>({id:String(i).padStart(5,'0'),subject:'Pathology',division:'General',type:'mcq'}));
  const db=database({questions});const attempt=await mock.startOpenTimedMock(db,'alice','Pathology','General',100);
  assert.equal(attempt.questions.length,100);assert.equal(new Set(attempt.questions.map(q=>q.id)).size,100);
  assert.equal(db.tables.timed_mock_attempts[0].user_id,'alice');assert.ok(Date.parse(attempt.expiresAt)>Date.now());
  assert.ok(db.calls.filter(c=>c.table==='questions'&&c.verb==='read').length>=3);noBilling(db);
}));
test('paused mocks restore only the caller’s unsubmitted attempt, preserving question order and deadline',()=>flag('false',async()=>{
  const expiry=new Date(Date.now()+60_000).toISOString();const db=database({timed_mock_attempts:[{id:'mine',user_id:'alice',subject:'Pathology',division:'General',submitted_at:null,expires_at:expiry,question_ids:['b','a']}],questions:[{id:'a'},{id:'b'}]});
  const result=await mock.startOpenTimedMock(db,'alice','Pathology','General',10);
  assert.equal(result.id,'mine');assert.equal(result.expiresAt,expiry);assert.deepEqual(result.questions.map(q=>q.id),['b','a']);assert.equal(db.calls.some(c=>c.verb==='insert'),false);
}));
test('invalid mock size, empty bank and enabled billing fail before an open-access attempt is inserted',async()=>{
  for(const value of ['false','true'])await flag(value,async()=>{
    const db=database();await assert.rejects(()=>mock.startOpenTimedMock(db,'alice','Pathology','General',value==='true'?10:999));
    assert.equal(db.calls.some(c=>c.verb==='insert'),false);
  });
  await flag('false',async()=>assert.rejects(()=>mock.startOpenTimedMock(database(),'alice','Pathology','General',10),/No questions/));
});

test('paused checkout responds with the exact 403 without authenticating, querying or calling a payment provider',()=>flag('false',async()=>{
  let calls=0;
  const route=await load('app/api/checkout/route.ts',{subscriptionsEnabled,NextResponse:{json:Response.json},createClient:async()=>{calls++;throw new Error('Unexpected checkout');}});
  const response=await route.POST(new Request('https://fixture.test/api/checkout',{method:'POST',body:'{}'}));
  assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'Subscriptions are temporarily closed.'});assert.equal(calls,0);
}));
test('session API refuses anonymous and foreign-owner requests before touching class usage',()=>flag('false',async()=>{
  const db=database({live_class_sessions:[current('foreign','bob')]});let user=null,adminCalls=0;
  const route=await load('app/api/voice/session/route.ts',{subscriptionsEnabled,...runtime,NextResponse:{json:Response.json},createClient:async()=>({auth:{getUser:async()=>({data:{user}})}}),
    createAdminClient:()=>{adminCalls++;return db;},logAuthRequestRejection:()=>{},RoomServiceClient:class{},purgeSessionMaterialsOnEnd:async()=>[]});
  const request=()=>new Request('https://fixture.test/api/voice/session',{method:'POST',body:JSON.stringify({sessionId:'foreign',action:'heartbeat',durationSeconds:999999})});
  assert.equal((await route.POST(request())).status,401);assert.equal(adminCalls,0);
  user={id:'alice'};assert.equal((await route.POST(request())).status,404);noBilling(db);
  assert.equal(db.calls.some(c=>c.verb==='update'),false);
}));

test('paused access unlocks a real free account without reporting it paid or admin',()=>flag('false',async()=>{
  const access=await load('lib/subscription-access.ts',{subscriptionsEnabled,getPaidPlan});
  const result=access.getSubscriptionAccess({role:'user',plan:'free',voice_minutes_balance:0});
  assert.equal(result.allAccess,true);assert.equal(result.textTutor,true);assert.equal(result.unlimited,true);
  assert.equal(result.admin,false);assert.equal(result.paid,false);assert.equal(result.voiceMinutes,null);assert.equal(result.mockExams,null);
}));
test('pricing renders exactly one full-access panel and no subscription buttons while paused; true restores plans',async()=>{
  const pricing=await load('app/pricing/PricingClient.tsx',{subscriptionsEnabled,getPaidPlan,PUBLIC_PAID_PLANS,useState,
    Link:({href,children,...props})=>createElement('a',{href,...props},children)});
  await flag('false',()=>{
    const html=renderToStaticMarkup(createElement(pricing.default,{}));
    assert.equal((html.match(/Full Access Enabled/g)||[]).length,1);assert.doesNotMatch(html,/Opening checkout|Choose Scholar|Renew plan|Explorer/);
    assert.match(html,/href="\/voice\?mode=class"/);
  });
  await flag('true',()=>{const html=renderToStaticMarkup(createElement(pricing.default,{}));assert.match(html,/Choose Scholar/);assert.doesNotMatch(html,/Full Access Enabled/);});
});
test('history GET exposes only the verified caller’s conversations through the paused service client',()=>flag('false',async()=>{
  const db=database({teaching_conversations:[{id:'mine',user_id:'alice',deleted_at:null,session_type:'live_class'},{id:'theirs',user_id:'bob',deleted_at:null,session_type:'live_class'}]});
  service=db;const route=await load('app/api/teaching/conversations/route.ts',{subscriptionsEnabled,...runtime,
    NextResponse:{json:Response.json},createClient:async()=>db,logAuthRequestRejection:()=>{}});
  const response=await route.GET(new Request('https://fixture.test/api/teaching/conversations?sessionType=live_class'));
  assert.equal(response.status,200);assert.deepEqual((await response.json()).conversations.map(c=>c.id),['mine']);
}));
test('editable recording metadata cannot sign a different owner’s Storage object',()=>flag('false',async()=>{
  const db=database({teaching_conversations:[{id:'mine',user_id:'alice',deleted_at:null,session_type:'live_class',recording_path:'bob/secret.webm'}]});
  service=db;const route=await load('app/api/voice/recording/route.ts',{...runtime,NextResponse:{json:Response.json},createClient:async()=>db});
  const response=await route.GET(new Request('https://fixture.test/api/voice/recording?conversationId=mine'));
  assert.equal(response.status,403);
}));
