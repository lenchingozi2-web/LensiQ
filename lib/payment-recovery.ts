import {createServiceClient} from '@/lib/supabase/service';
import {getPaidPlan} from '@/lib/plans';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ProviderBody={status?:string;data?:{id?:number|string;status?:string;currency?:string;amount?:number;tx_ref?:string;meta?:Record<string,unknown>|string}};
async function settleVerifiedProviderData(body:ProviderBody,expected:{id?:string;reference?:string}){
 const tx=body.data;const meta=typeof tx?.meta==='string'?JSON.parse(tx.meta):tx?.meta;
 const plan=getPaidPlan(meta?.plan_id);const userId=String(meta?.user_id||'');const reference=String(tx?.tx_ref||'');
 const prefix=`lenxiq_subscription_${userId}_${plan?.id||''}_`;
 if(body.status!=='success'||tx?.status!=='successful'||!plan||!uuid.test(userId)||tx.currency!=='NGN'||Number(tx.amount)!==plan.amountNaira||Number(meta?.plan_duration)!==1||meta?.product_type!=='subscription'||!reference.startsWith(prefix)||!uuid.test(reference.slice(prefix.length))||!/^\d{1,24}$/.test(String(tx.id))||(expected.id&&String(tx.id)!==expected.id)||(expected.reference&&reference!==expected.reference))throw new Error('Payment does not match the subscription');
 const db=createServiceClient();
 const readReceipt=()=>db.from('subscription_checkouts').select('user_id,plan_id,amount_ngn').eq('tx_ref',reference).maybeSingle();
 let {data:receipt,error:receiptError}=await readReceipt();
 if(receiptError)throw new Error('Checkout record unavailable');
 if(!receipt){
  // Preserve already issued, provider-verified checkouts across deployments. Never overwrite an existing receipt.
  const {error}=await db.from('subscription_checkouts').upsert({tx_ref:reference,user_id:userId,plan_id:plan.id,amount_ngn:plan.amountNaira},{onConflict:'tx_ref',ignoreDuplicates:true});
  if(error)throw new Error('Checkout record unavailable');
  const reread=await readReceipt();receipt=reread.data;receiptError=reread.error;
 }
 if(receiptError||!receipt||receipt.user_id!==userId||receipt.plan_id!==plan.id||Number(receipt.amount_ngn)!==plan.amountNaira)throw new Error('Checkout does not belong to this subscription');
 const {data:settlement,error}=await db.rpc('settle_verified_payment',{p_payment_reference:`flutterwave:${tx.id}`,p_user_id:userId,p_event_type:'subscription_payment',p_plan_id:plan.id,p_plan_duration:1,p_revenue_amount_ngn:plan.amountNaira,p_metadata:{provider:'flutterwave',transaction_id:String(tx.id),tx_ref:reference,plan_id:plan.id}});
 const result=Array.isArray(settlement)?settlement[0]:settlement;
 if(error||(!result?.settled&&!result?.already_settled))throw new Error('Verified payment activation is pending');
 const {data:profile,error:profileError}=await db.from('profiles').select('plan,role,plan_expires_at').eq('id',userId).maybeSingle();
 if(profileError||!profile||(profile.role!=='admin'&&(!getPaidPlan(profile.plan)||!profile.plan_expires_at||!Number.isFinite(Date.parse(profile.plan_expires_at))||Date.parse(profile.plan_expires_at)<=Date.now())))throw new Error('Subscription activation is pending');
 return {userId,planId:plan.id};
}
export async function settleFlutterwaveTransaction(transactionId:string){
 if(!/^\d{1,24}$/.test(transactionId)||!process.env.FLUTTERWAVE_SECRET_KEY)throw new Error('Invalid payment verification request');
 const response=await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,{headers:{Authorization:`Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`},cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Payment verification unavailable');
 return settleVerifiedProviderData(await response.json(),{id:transactionId});
}
export async function reconcilePendingCheckout(userId:string):Promise<{state:'none'|'checked'|'unavailable';activated:number}>{
 if(!process.env.FLUTTERWAVE_SECRET_KEY)return {state:'unavailable',activated:0};
 try{
  const db=createServiceClient();const {data,error}=await db.rpc('claim_pending_checkouts',{p_user_id:userId});
  if(error)return {state:'unavailable',activated:0};
  const receipts=(data??[]) as Array<{user_id:string;tx_ref:string;created_at:string}>;
  if(!receipts.length)return {state:'none',activated:0};
  const responses=await Promise.all(receipts.map(async receipt=>{
   if(receipt.user_id!==userId)return null;
   try{
    const response=await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(receipt.tx_ref)}`,{headers:{Authorization:`Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`},cache:'no-store',signal:AbortSignal.timeout(6000)});
    return response.ok?{receipt,body:await response.json() as ProviderBody}:null;
   }catch{return null;}
  }));
  let activated=0;
  // Settle in purchase order, independently: an unpaid later checkout cannot mask a paid earlier one.
  responses.sort((a,b)=>Date.parse(a?.receipt.created_at??'')-Date.parse(b?.receipt.created_at??''));
  for(const response of responses){if(!response||response.body.data?.status!=='successful')continue;try{await settleVerifiedProviderData(response.body,{reference:response.receipt.tx_ref});activated++;}catch{/* Retain the unsettled receipt for a later retry. */}}
  return {state:'checked',activated};
 }catch{return {state:'unavailable',activated:0};}
}
