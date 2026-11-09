import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {SpokenCueQueue} from '../lib/voice/spoken-cues.ts';

test('board cues wait for browser audio and interruptions discard stale notes',async()=>{
 const queue=new SpokenCueQueue(20); const shown=[];
 queue.schedule(()=>shown.push('current point'));
 assert.deepEqual(shown,[]);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.deepEqual(shown,['current point']);
 queue.schedule(()=>shown.push('interrupted point'));queue.clear();
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.deepEqual(shown,['current point']);
});

test('the actual hold handler orders start, streaming, stop, then submission exactly once',async()=>{
 const page=await readFile(new URL('../app/voice/page.tsx',import.meta.url),'utf8');
 const start=page.indexOf('  const setPressMicrophone = useCallback(');
 const end=page.indexOf('\n  useEffect(',start);
 let source=page.slice(start,end).replace('const setPressMicrophone','export const setPressMicrophone');
 const calls=[];const phases=[];
 const room={localParticipant:{async publishData(data){calls.push(JSON.parse(new TextDecoder().decode(data)).type);},async setMicrophoneEnabled(enabled){await new Promise(resolve=>setTimeout(resolve,3));calls.push(enabled?'streaming':'stopped');}}};
 globalThis.__hold={useCallback:fn=>fn,roomRef:{current:room},pressHeldRef:{current:false},pressTurnRef:{current:null},microphoneQueueRef:{current:Promise.resolve()},spokenCuesRef:{current:{clear(){}}},setPressPhase:phase=>phases.push(phase),setRuntimeState:()=>{},setStatus:()=>{},setMicMuted:()=>{},setError:error=>assert.fail(error)};
 const preamble='const {useCallback,roomRef,pressHeldRef,pressTurnRef,microphoneQueueRef,spokenCuesRef,setPressPhase,setRuntimeState,setStatus,setMicMuted,setError}=globalThis.__hold;\n';
 const {setPressMicrophone}=await import('data:text/javascript;base64,'+Buffer.from(preamble+stripTypeScriptTypes(source)).toString('base64'));
 setPressMicrophone(true);setPressMicrophone(true);setPressMicrophone(false);setPressMicrophone(false);
 assert.deepEqual(phases,['holding','processing']);
 await globalThis.__hold.microphoneQueueRef.current;
 assert.deepEqual(calls,['ptt_start','streaming','stopped','ptt_end']);
 assert.equal(globalThis.__hold.pressHeldRef.current,false);
 delete globalThis.__hold;
});

test('the live class does not render the private focus prompt as board content',async()=>{
 const source=await readFile(new URL('../app/voice/page.tsx',import.meta.url),'utf8');
 assert.ok(!source.includes('markdown: `### Study focus'));
 assert.ok(source.includes('inputMode: \'press_to_talk\''));
});
