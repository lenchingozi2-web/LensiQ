import test from 'node:test';
import assert from 'node:assert/strict';
import { inPool, retryStep } from '../lib/rag/compile-pool.ts';

test('42 concepts run with at most three requests; one lost response retries the same concept',async()=>{
  let active=0,peak=0;const attempts=new Map(),done=[],flagged=[];
  await inPool(Array.from({length:42},(_,i)=>i),async id=>{
    try{
      await retryStep(async()=>{
        active++;peak=Math.max(peak,active);
        const attempt=(attempts.get(id)||0)+1;attempts.set(id,attempt);
        await new Promise(r=>setTimeout(r,1));active--;
        if(id===11||id===1&&attempt<3)throw new Error('504');
        done.push(id);
      },new AbortController().signal,2);
    }catch{flagged.push(id);}
  },3);
  assert.equal(peak,3);assert.deepEqual(flagged,[11]);assert.equal(attempts.get(1),3);
  assert.equal(new Set(done).size,41);assert.equal(attempts.get(11),3);
});

test('ending a class cancels pending retries before another write',async()=>{
  const controller=new AbortController();let calls=0;
  await assert.rejects(retryStep(async()=>{calls++;controller.abort();throw new Error('offline');},controller.signal,1));
  assert.equal(calls,1);
});
