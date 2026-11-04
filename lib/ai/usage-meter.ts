/** No prompts, documents, answers, keys or audio are stored in the usage ledger. */
export type UsageDetail = {provider:'gemini'|'groq';model:string;inputTokens:number;outputTokens:number;cachedTokens:number;thinkingTokens:number;tokenSource:'provider'|'estimate'|'cache';estimatedCostUsd:number};
const count=(n:unknown)=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
export function priceUsage(provider:'gemini'|'groq',model:string,input:number,output:number,cached=0,now=Date.now()) {
 let inRate:number,outRate:number,cacheRate:number;
 if(provider==='gemini'){
  const intro=now<Date.parse('2027-01-01T00:00:00Z');
  [inRate,outRate,cacheRate]=intro?[.75,3.75,.075]:[1.5,7.5,.15];
  if(model==='gemini-3-flash-preview')[inRate,outRate,cacheRate]=[.5,3,.05];
 }else{
  [inRate,outRate,cacheRate]=model==='openai/gpt-oss-20b'?[.075,.30,.075]:model==='openai/gpt-oss-120b'?[.15,.60,.15]:[.8,4,.8];
 }
 return (Math.max(0,input-cached)*inRate+Math.min(input,cached)*cacheRate+output*outRate)/1_000_000;
}
export function usageFromPayload(payload:unknown,provider:'gemini'|'groq',model:string,fallbackInputCharacters=0,fallbackOutputCharacters=0):UsageDetail {
 const obj=(payload??{}) as Record<string,unknown>;
 const u=(obj.usageMetadata??obj.usage??(obj.x_groq as Record<string,unknown>|undefined)?.usage) as Record<string,unknown>|undefined;
 const measured=!!u&&(u.promptTokenCount!==undefined||u.prompt_tokens!==undefined||u.total_input_tokens!==undefined);
 const inputTokens=measured?count(u!.promptTokenCount??u!.prompt_tokens??u!.total_input_tokens):Math.ceil(fallbackInputCharacters/4);
 const thinkingTokens=count(u?.thoughtsTokenCount??u?.total_thought_tokens??(u?.completion_tokens_details as Record<string,unknown>)?.reasoning_tokens);
 const outputTokens=measured?(u!.candidatesTokenCount!==undefined?count(u!.candidatesTokenCount)+thinkingTokens:count(u!.completion_tokens??u!.total_output_tokens)):Math.ceil(fallbackOutputCharacters/4);
 const cachedTokens=Math.min(inputTokens,count(u?.cachedContentTokenCount??u?.total_cached_tokens??(u?.prompt_tokens_details as Record<string,unknown>)?.cached_tokens));
 return {provider,model,inputTokens,outputTokens,cachedTokens,thinkingTokens,tokenSource:measured?'provider':'estimate',estimatedCostUsd:priceUsage(provider,model,inputTokens,outputTokens,cachedTokens)};
}

/** Inspect a bounded SSE buffer while forwarding the original bytes unchanged. */
export function observeAiStream(stream:ReadableStream<Uint8Array>,options:{provider:'gemini'|'groq';model:string;inputCharacters:number;onFinish:(usage:UsageDetail,hasOutput:boolean,outcome:string)=>Promise<void>}){
 const reader=stream.getReader();const decoder=new TextDecoder();let buffer='';let latest:unknown;let outputCharacters=0;let done=false;
 function event(line:string){
  if(!line.startsWith('data:'))return;const raw=line.slice(5).trim();if(!raw||raw==='[DONE]')return;
  try{
   const data=JSON.parse(raw);if(data.usage||data.usageMetadata||data.x_groq?.usage)latest=data;
   const text=data.choices?.map((c:{delta?:{content?:string};message?:{content?:string}})=>c.delta?.content??c.message?.content??'').join('')??data.candidates?.flatMap((c:{content?:{parts?:Array<{text?:string;thought?:boolean}>}})=>c.content?.parts?.filter(p=>!p.thought).map(p=>p.text??'')??[]).join('')??'';
   outputCharacters+=text.length;
  }catch{/* Incomplete non-JSON SSE frames are not token records. */}
 }
 function parse(chunk:Uint8Array){buffer+=decoder.decode(chunk,{stream:true});let at;while((at=buffer.indexOf('\n'))>=0){event(buffer.slice(0,at).replace(/\r$/,''));buffer=buffer.slice(at+1);}if(buffer.length>256000)buffer=buffer.slice(-256000);}
 async function finish(outcome:string){if(done)return;done=true;if(buffer.trim())event(buffer.trim());await options.onFinish(usageFromPayload(latest,options.provider,options.model,options.inputCharacters,outputCharacters),outputCharacters>0,outcome);}
 return new ReadableStream<Uint8Array>({
  async pull(controller){try{const r=await reader.read();if(r.done){await finish('completed');controller.close();}else{parse(r.value);controller.enqueue(r.value);}}catch(error){await finish('failed');controller.error(error);}},
  async cancel(){try{await reader.cancel();}finally{await finish('cancelled');}}
 });
}
