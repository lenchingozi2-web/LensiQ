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
 state={calls:[],tx:{id:123,status:'successful',currency:'NGN',amount:29900,tx_ref:ref,meta:{product_type:'subscription',user_id:user,plan_id:'intensive',plan_duration:1}},receipt:{user_id:user,plan_id:'intensive',amount_ngn:29900},profile:{plan:'intensive',role:'user',plan_expires_at:new Date(Date.now()+86400000).toISOString()}};
}
const service=()=>({
 from(table){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='profiles'?state.profile:state.receipt,error:null}),insert:async()=>({error:null}),update(){return this;},then(resolve){resolve({error:null});}};},
 async rpc(name,args){if(name==='claim_pending_checkouts')return {data:state.pending??[],error:state.claimError??null};state.calls.push({name,args});return {data:state.emptySettlement?[]:[{settled:true}],error:null};}
});
globalThis.__paymentTest={createServiceClient:service,getPaidPlan};
globalThis.fetch=async()=>({ok:true,json:async()=>({status:'success',data:state.tx})});
let source=await readFile(new URL('../lib/payment-recovery.ts',import.meta.url),'utf8');
source=source.replace(/^import .*;\n/gm,'');
const moduleSource='const {createServiceClient,getPaidPlan}=globalThis.__paymentTest;\n'+stripTypeScriptTypes(source);
const {settleFlutterwaveTransaction,reconcilePendingCheckout}=await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
test.after(()=>{globalThis.fetch=originalFetch;delete globalThis.__paymentTest;if(originalKey===undefined)delete process.env.FLUTTERWAVE_SECRET_KEY;else process.env.FLUTTERWAVE_SECRET_KEY=originalKey;});

test('only the three current paid products are recognized',()=>{
 for(const id of ['premium_monthly','premium_text_monthly','3mo','6mo','12mo','free'])assert.equal(getPaidPlan(id),undefined);
 assert.equal(getPaidPlan('intensive').voiceMinutes,360);
 assert.equal(getPaidPlan('all_access').mockExams,-1);
 assert.equal(getPaidPlan('intensive').mockExams,-1);
});
for(const [name,change] of [
 ['different transaction id',()=>state.tx.id=456],
 ['wrong product type',()=>state.tx.meta.product_type='topup'],
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

test('an empty database settlement cannot be reported as activated',async()=>{reset();state.emptySettlement=true;await assert.rejects(settleFlutterwaveTransaction('123'),/activation is pending/);});
test('a recovery lookup failure returns an unavailable state instead of breaking the account page',async()=>{reset();state.claimError={message:'unavailable'};assert.deepEqual(await reconcilePendingCheckout(state.tx.meta.user_id),{state:'unavailable',activated:0});});
test('a pending later checkout cannot mask an earlier paid checkout',async()=>{
 reset();const paid=structuredClone(state.tx);const user=paid.meta.user_id;
 state.pending=[{tx_ref:paid.tx_ref,user_id:user,created_at:'2026-11-01T00:00:00Z'},{tx_ref:'unpaid-later',user_id:user,created_at:'2026-11-02T00:00:00Z'}];
 globalThis.fetch=async url=>({ok:true,json:async()=>({status:'success',data:new URL(url).searchParams.get('tx_ref')===paid.tx_ref?paid:{status:'pending'}})});
 try{assert.deepEqual(await reconcilePendingCheckout(user),{state:'checked',activated:1});assert.equal(state.calls.length,1);}finally{globalThis.fetch=async()=>({ok:true,json:async()=>({status:'success',data:state.tx})});}
});
