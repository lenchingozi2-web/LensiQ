import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {getPaidPlan} from '../lib/plans.ts';
const originalFetch=globalThis.fetch;
const originalKey=process.env.FLUTTERWAVE_SECRET_KEY;
process.env.FLUTTERWAVE_SECRET_KEY='test-only-local-key';
let state;
function reset(){
 const user='11111111-1111-4111-8111-111111111111';
 const ref=`lenxiq_subscription_${user}_intensive_22222222-2222-4222-8222-222222222222`;
 state={calls:[],tx:{id:123,status:'successful',currency:'NGN',amount:29900,tx_ref:ref,meta:{user_id:user,plan_id:'intensive',plan_duration:1}},receipt:{user_id:user,plan_id:'intensive',amount_ngn:29900},profile:{plan:'intensive',role:'user',plan_expires_at:new Date(Date.now()+86400000).toISOString()}};
}
const service=()=>({
 from(table){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='profiles'?state.profile:state.receipt,error:null}),insert:async()=>({error:null}),update(){return this;},then(resolve){resolve({error:null});}};},
 async rpc(name,args){state.calls.push({name,args});return {data:[{settled:true}],error:null};}
});
globalThis.__paymentTest={createServiceClient:service,getPaidPlan};
globalThis.fetch=async()=>({ok:true,json:async()=>({status:'success',data:state.tx})});
let source=await readFile(new URL('../lib/payment-recovery.ts',import.meta.url),'utf8');
source=source.replace(/^import .*;\n/gm,'');
const moduleSource='const {createServiceClient,getPaidPlan}=globalThis.__paymentTest;\n'+stripTypeScriptTypes(source);
const {settleFlutterwaveTransaction}=await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__paymentTest;if(originalKey===undefined)delete process.env.FLUTTERWAVE_SECRET_KEY;else process.env.FLUTTERWAVE_SECRET_KEY=originalKey;});

test('only the three current paid products are recognized',()=>{
 for(const id of ['premium_monthly','premium_text_monthly','3mo','6mo','12mo','free'])assert.equal(getPaidPlan(id),undefined);
 assert.equal(getPaidPlan('intensive').voiceMinutes,360);
 assert.equal(getPaidPlan('all_access').mockExams,-1);
 assert.equal(getPaidPlan('intensive').mockExams,-1);
});
for(const [name,change] of [
 ['wrong amount',()=>state.tx.amount=9870],
 ['wrong currency',()=>state.tx.currency='USD'],
 ['unpaid transaction',()=>state.tx.status='pending'],
 ['retired plan',()=>state.tx.meta.plan_id='premium_monthly'],
 ['different subscriber receipt',()=>state.receipt.user_id='other-user'],
 ['different product receipt',()=>state.receipt.plan_id='scholar'],
 ['tampered reference',()=>state.tx.tx_ref='forged-reference'],
])test(`reject ${name} before any entitlement write`,async()=>{reset();change();await assert.rejects(settleFlutterwaveTransaction('123'));assert.equal(state.calls.length,0);});

test('a verified payment settles only the provider-verified subscriber and amount',async()=>{
 reset();const result=await settleFlutterwaveTransaction('123');assert.equal(result.planId,'intensive');
 assert.equal(state.calls.length,1);assert.equal(state.calls[0].name,'settle_verified_payment');
 assert.equal(state.calls[0].args.p_revenue_amount_ngn,29900);assert.equal(state.calls[0].args.p_payment_reference,'flutterwave:123');
 assert.equal(state.calls[0].args.p_user_id,state.tx.meta.user_id);
});
test('missing activation cannot be reported as successful',async()=>{
 reset();state.profile.plan='free';await assert.rejects(settleFlutterwaveTransaction('123'),/activation is pending/);
});
