import {createServiceClient} from '@/lib/supabase/service';
import type {UsageDetail} from './usage-meter';
export async function finishAiRequest(id:string|undefined,success:boolean){
 if(!id)return;
 try{const {error}=await createServiceClient().rpc('finish_ai_request',{p_request_id:id,p_success:success});if(error)console.error('AI request settlement requires retry');}catch{console.error('AI request settlement unavailable');}
}
export async function recordAiUsage(userId:string,feature:string,usage:UsageDetail,options:{reservationId?:string;success?:boolean;outcome?:string;eventId?:string}={}){
 try{
  const {error}=await createServiceClient().from('study_ai_usage').upsert({id:options.eventId??crypto.randomUUID(),user_id:userId,reservation_id:options.reservationId??null,feature,provider:usage.provider,model:usage.model,input_tokens:usage.inputTokens,output_tokens:usage.outputTokens,cached_tokens:usage.cachedTokens,thinking_tokens:usage.thinkingTokens,estimated_cost_usd:usage.estimatedCostUsd,token_source:usage.tokenSource,outcome:options.outcome??'completed'},{onConflict:'id',ignoreDuplicates:true});
  if(error)console.error('AI usage record unavailable');
 }catch{console.error('AI usage record unavailable');}
 await finishAiRequest(options.reservationId,options.success!==false);
}
