import test from 'node:test';
import assert from 'node:assert/strict';
import {openSpokenResponse} from '../lib/voice/open-spoken-response.ts';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {observeAiStream,usageFromPayload} from '../lib/ai/usage-meter.ts';
const encoder = new TextEncoder();
const event = text => 'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n';

test('empty or reasoning-only output is rejected before committing a response', async t => {
  let observed;
  t.mock.method(globalThis,'fetch',async()=>new Response('data: {"choices":[{"delta":{"reasoning":"thinking"}}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":12}}\n\ndata: [DONE]\n\n'));
  const result=await openSpokenResponse('https://fixture.test',{}, {timeoutMs:100,stream:true,onEmpty:value=>{observed=value;}});
  assert.equal(result.status,502);assert.equal(observed.usage.prompt_tokens,12);
});

test('fragmented speech and usage pass through byte-for-byte without waiting for completion',async t=>{
  let output;
  const original='data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n'+event('Neutrophils arrive first.');
  t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(c){output=c;c.enqueue(encoder.encode(original.slice(0,30)));c.enqueue(encoder.encode(original.slice(30)));}})));
  const response=await openSpokenResponse('https://fixture.test',{}, {timeoutMs:25,stream:true});
  const reading=response.text();
  await new Promise(resolve=>setTimeout(resolve,40)); // A healthy stream outlives its first-text deadline.
  output.enqueue(encoder.encode('data: [DONE]\n\n'));output.close();
  assert.equal(await reading,original+'data: [DONE]\n\n');
});

test('a provider which opens headers but never speaks times out and is cancelled',async t=>{
  let cancelled=false;
  t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({cancel(){cancelled=true;}})));
  await assert.rejects(openSpokenResponse('https://fixture.test',{}, {timeoutMs:15,stream:true}),{name:'TimeoutError'});
  assert.equal(cancelled,true);
});

test('learner interruption cancels an unopened answer immediately',async t=>{
  const controller=new AbortController();let cancelled=false;
  t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({cancel(){cancelled=true;}})));
  const waiting=openSpokenResponse('https://fixture.test',{signal:controller.signal},{timeoutMs:500,stream:true});
  await new Promise(resolve=>setTimeout(resolve,2));controller.abort();
  await assert.rejects(waiting,{name:'AbortError'});assert.equal(cancelled,true);
});

test('cancelling a spoken response cancels its upstream audio-text stream',async t=>{
  let cancelled=false;
  t.mock.method(globalThis,'fetch',async()=>new Response(new ReadableStream({start(c){c.enqueue(encoder.encode(event('Hello.')));},cancel(){cancelled=true;}})));
  const response=await openSpokenResponse('https://fixture.test',{}, {timeoutMs:100,stream:true});
  await response.body.cancel();assert.equal(cancelled,true);
});

test('gateway falls back once on empty Groq output and accounts for both providers',async t=>{
  const deferred=[],usage=[],calls=[];
  const db={from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'session'}})}),rpc:async()=>({data:true})};
  globalThis.__voiceStreamTest={openSpokenResponse,observeAiStream,usageFromPayload,
    recordAiUsage:async(...args)=>{usage.push(args);},
    verifyLiveClassGatewayToken:()=>({user:'student',session:'session',room:'room'}),
    createAdminClient:()=>db,after:fn=>deferred.push(fn),NextResponse:{json:Response.json}};
  t.after(()=>{delete globalThis.__voiceStreamTest;});
  t.mock.property(process,'env',{...process.env,LIVEKIT_API_SECRET:'fixture',GROQ_API_KEY:'fixture',GEMINI_API_KEY:'fixture'});
  t.mock.method(globalThis,'fetch',async url=>{
    calls.push(url);
    return new Response(url.includes('groq.com')?'data: {"choices":[],"usage":{"prompt_tokens":20,"completion_tokens":5}}\n\ndata: [DONE]\n\n':event('Inflammation recruits protective cells.')+'data: [DONE]\n\n');
  });
  let source=await readFile(new URL('../app/api/voice/llm/v1/chat/completions/route.ts',import.meta.url),'utf8');
  source=source.replace(/^import .*\n/gm,'');
  const names=Object.keys(globalThis.__voiceStreamTest).join(',');
  const mod=await import('data:text/javascript;base64,'+Buffer.from('const {'+names+'}=globalThis.__voiceStreamTest;\n'+stripTypeScriptTypes(source)).toString('base64'));
  const response=await mod.POST(new Request('https://fixture.test',{method:'POST',body:JSON.stringify({messages:[{role:'user',content:'Explain inflammation.'}],stream:true})}));
  assert.equal(response.status,200);assert.equal(response.headers.get('X-LenxiQ-Verbalizer'),'gemini');
  assert.match(await response.text(),/Inflammation recruits/);assert.equal(calls.length,2);
  await Promise.all(deferred.map(fn=>fn()));
  assert.ok(usage.some(args=>args[2].provider==='groq'&&args[3].outcome==='empty'));
  assert.ok(usage.some(args=>args[2].provider==='gemini'&&args[3].outcome==='completed'));
});
