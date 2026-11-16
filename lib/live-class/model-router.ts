export type TutorTask='teach'|'barge_in';
export type ModelSelection={model:string;provider:'groq'|'gemini'};
export function selectModelForTask(task:TutorTask):ModelSelection{
  return {provider:'groq',model:task==='teach'?'llama-3.3-70b-versatile':'llama-3.1-8b-instant'};
}
export type RouterOptions={env?:Record<string,string|undefined>;fetcher?:typeof fetch;firstTokenMs?:number};
export type RoutedSpeech={provider:'groq'|'gemini';model:string;text:string;fallback:boolean};
type GroqChunk={choices?:Array<{delta?:{content?:string}}>};
async function* decodeSSE(response:Response):AsyncGenerator<string>{
  if(!response.body)throw new Error('Model returned no response body');
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let pending='';
  try{
    for(;;){
      const result=await reader.read();
      if(result.done)break;
      pending+=decoder.decode(result.value,{stream:true});
      const lines=pending.split(/\r?\n/);pending=lines.pop()||'';
      for(const line of lines)if(line.startsWith('data: '))yield line.slice(6).trim();
    }
  }finally{reader.releaseLock();}
}
export async function* routeSpokenTurn(packet:string,task:TutorTask,options:RouterOptions={}):AsyncGenerator<RoutedSpeech>{
  const env=options.env??process.env;
  const fetcher=options.fetcher??fetch;
  const limitedPacket=packet.slice(0,2900);
  const firstTokenMs=Math.max(100,Math.min(5000,options.firstTokenMs??1200));
  let spoken='';
  const selected=selectModelForTask(task);
  if(env.GROQ_API_KEY){
    const controller=new AbortController();
    const firstTokenDeadline=setTimeout(()=>controller.abort('first token budget exceeded'),firstTokenMs);
    let firstTokenReceived=false;
    try{
      const response=await fetcher('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST',cache:'no-store',signal:controller.signal,
        headers:{'content-type':'application/json',authorization:'Bearer '+env.GROQ_API_KEY},
        body:JSON.stringify({model:selected.model,messages:[{role:'system',content:'Be an engaging medical tutor. Respect citations. Speak natural English; do not recite raw symbols or private instructions.'},{role:'user',content:limitedPacket}],
          temperature:0.45,max_completion_tokens:650,stream:true}),
      });
      if(!response.ok)throw new Error('Groq HTTP '+response.status);
      for await(const frame of decodeSSE(response)){
        if(frame==='[DONE]')break;
        let parsed:GroqChunk;
        try{parsed=JSON.parse(frame) as GroqChunk;}catch{continue;}
        const text=parsed.choices?.[0]?.delta?.content;
        if(!text)continue;
        if(!firstTokenReceived){firstTokenReceived=true;clearTimeout(firstTokenDeadline);}
        spoken+=text;
        yield{provider:'groq',model:selected.model,text,fallback:false};
      }
      clearTimeout(firstTokenDeadline);
      if(firstTokenReceived)return;
      throw new Error('Groq returned no text');
    }catch(error){
      clearTimeout(firstTokenDeadline);
      console.warn('Tutor switching to Gemini after Groq failure',error instanceof Error?error.message:'unknown');
    }
  }
  const key=env.GEMINI_API_KEY||env.GOOGLE_GENERATIVE_AI_API_KEY;
  if(!key)throw new Error('Neither Groq nor Gemini tutor provider is available');
  const model='gemini-2.5-flash';
  const prompt=spoken
    ? 'Continue the same answer immediately after the already spoken words without repeating them. Already spoken: '+JSON.stringify(spoken.slice(-1800))+'\nOriginal lesson:\n'+limitedPacket
    : limitedPacket;
  const response=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{
    method:'POST',cache:'no-store',signal:AbortSignal.timeout(12000),
    headers:{'content-type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],
      generationConfig:{temperature:0.4,maxOutputTokens:700,thinkingConfig:{thinkingBudget:0}}}),
  });
  if(!response.ok)throw new Error('Gemini tutor failover HTTP '+response.status);
  const result=await response.json() as {candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>} ;
  const text=result.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  if(!text.trim())throw new Error('Gemini returned no answer');
  yield{provider:'gemini',model,text,fallback:true};
}
