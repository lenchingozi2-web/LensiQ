import {createServiceClient} from '@/lib/supabase/service';
import {getPaidPlan} from '@/lib/plans';

/** Both callback activation and recovery verify a provider response and the stored checkout. */
export async function settleFlutterwaveTransaction(transactionId:string) {
 if(!/^[0-9]{1,24}$/.test(transactionId)||!process.env.FLUTTERWAVE_SECRET_KEY) throw new Error('Invalid payment verification request');
 const response=await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,{headers:{Authorization:`Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`},cache:'no-store',signal:AbortSignal.timeout(10000)});
 const body=await response.json();const tx=body?.data;
 const meta=typeof tx?.meta==='string'?JSON.parse(tx.meta):tx?.meta;
 const plan=getPaidPlan(meta?.plan_id);const userId=String(meta?.user_id||'');const ref=String(tx?.tx_ref||'');
 const prefix=`lenxiq_subscription_${userId}_${plan?.id||''}_`;
 if(!response.ok||body.status!=='success'||tx?.status!=='successful'||!plan||tx.currency!=='NGN'||Number(tx.amount)!==plan.amountNaira||Number(meta?.plan_duration)!==1||!ref.startsWith(prefix)||!/^[0-9a-f-]{36}$/i.test(ref.slice(prefix.length))) throw new Error('Payment does not match the subscription');
 const db=createServiceClient();
 const {data:receipt,error:receiptError}=await db.from('subscription_checkouts').select('user_id,plan_id,amount_ngn').eq('tx_ref',ref).maybeSingle();
 if(receiptError||(receipt&&(receipt.user_id!==userId||receipt.plan_id!==plan.id||Number(receipt.amount_ngn)!==plan.amountNaira))) throw new Error('Checkout record could not be confirmed');
 // An already-issued checkout from the immediately preceding deployment is still provider-verified.
 if(!receipt){const {error:recordError}=await db.from('subscription_checkouts').insert({tx_ref:ref,user_id:userId,plan_id:plan.id,amount_ngn:plan.amountNaira});if(recordError)throw new Error('Checkout record unavailable');}
 const {error}=await db.rpc('settle_verified_payment',{p_payment_reference:`flutterwave:${tx.id}`,p_user_id:userId,p_event_type:'subscription_payment',p_plan_id:plan.id,p_plan_duration:1,p_revenue_amount_ngn:plan.amountNaira,p_metadata:{provider:'flutterwave',transaction_id:String(tx.id),tx_ref:ref,plan_id:plan.id}});
 if(error)throw new Error('Verified payment activation is pending');
 const {data:profile,error:profileError}=await db.from('profiles').select('plan,role,plan_expires_at').eq('id',userId).maybeSingle();
 if(profileError||!profile||(profile.role!=='admin'&&(!getPaidPlan(profile.plan)||!profile.plan_expires_at||Date.parse(profile.plan_expires_at)<=Date.now())))throw new Error('Subscription activation is pending');
 await db.from('subscription_checkouts').update({settled_at:new Date().toISOString()}).eq('tx_ref',ref);
 return {userId,planId:plan.id};
}

/** Recover a paid checkout when a phone/browser never returns through the provider callback. */
export async function reconcilePendingCheckout(userId:string) {
 if(!process.env.FLUTTERWAVE_SECRET_KEY)return;
 const db=createServiceClient();
 const {data:receipt,error}=await db.from('subscription_checkouts').select('tx_ref,last_checked_at').eq('user_id',userId).is('settled_at',null).gte('created_at',new Date(Date.now()-14*86400000).toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error||!receipt||(receipt.last_checked_at&&Date.parse(receipt.last_checked_at)>Date.now()-60000))return;
 await db.from('subscription_checkouts').update({last_checked_at:new Date().toISOString()}).eq('tx_ref',receipt.tx_ref).eq('user_id',userId);
 try {
  const response=await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(receipt.tx_ref)}`,{headers:{Authorization:`Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`},cache:'no-store',signal:AbortSignal.timeout(6000)});
  const body=await response.json();
  if(response.ok&&body?.data?.status==='successful'&&body.data.tx_ref===receipt.tx_ref)await settleFlutterwaveTransaction(String(body.data.id));
 } catch { /* The verified checkout remains pending and can safely be retried. */ }
}
