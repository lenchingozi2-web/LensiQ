/**
 * Prepare source-preserving thematic chunks before the LiveKit voice loop.
 * Gemini enriches the syllabus only; complete clinical text stays in each chunk.
 */
import { LIVE_CLASS_MODEL_ASSETS, LIVE_CLASS_MOLECULE_ASSETS } from '@/lib/voice/live-class-visuals';

type Visual = {type:'whiteboard'|'model'|'molecule';topic:string;markdown?:string;modelKey?:string;note?:string};
function visualFor(title:string,content:string):Visual {
  const subject=(title+' '+content.slice(0,400)).toLowerCase();
  const models:[RegExp,keyof typeof LIVE_CLASS_MODEL_ASSETS][]=[
    [/renal anatomy|kidney structure|nephron|renal cortex/,'kidneys'],
    [/leukemia blast|leukaemia blast/,'leukemiaBlastMorphology'],
    [/leukocyte morphology/,'leukocyteMorphology'],
    [/blood.cell morphology/,'bloodCellMorphology'],
    [/epithelial dysplasia/,'epithelialDysplasia'],
    [/atheroscleros/,'atherosclerosis'],
    [/tumou?r microenvironment/,'tumorMicroenvironment'],
    [/granulomatous inflammation/,'granulomatousInflammation'],
    [/fatty liver|steatosis/,'fattyLiver'],
  ];
  const molecules:[RegExp,keyof typeof LIVE_CLASS_MOLECULE_ASSETS][]=[
    [/beta.?2 adrenergic receptor|carazolol/,'beta2Adrenergic'],
    [/acetylcholinesterase|donepezil/,'acetylcholinesterase'],
    [/dihydrofolate reductase|methotrexate/,'dihydrofolateReductase'],
  ];
  const note=content.replace(/\s+/g,' ').slice(0,245);
  for(const [pattern,modelKey] of molecules)if(pattern.test(subject))return{type:'molecule',topic:title,modelKey,note};
  for(const [pattern,modelKey] of models)if(pattern.test(subject))return{type:'model',topic:title,modelKey,note};
  const sentences=content.replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).filter(s=>s.length>22).slice(0,4);
  return{type:'whiteboard',topic:title,markdown:'### '+title+'\n\n'+sentences.map(s=>'- '+s.slice(0,180)).join('\n')};
}
export async function createClassMaterialMap(text:string,sourceFileName:string) {
  const portions:string[]=[];
  for(let i=0;i<text.length;i+=2500)portions.push(text.slice(i,i+2750));
  const titles=portions.map((part,i)=>part.split(/\n/).map(s=>s.trim()).find(s=>s.length>5&&s.length<100)||'Lecture section '+(i+1));
  let enriched:string[]|null=null;
  if(process.env.GEMINI_API_KEY&&portions.length<=32){
    const model=process.env.GEMINI_CLASS_MAP_MODEL||'gemini-3.8-flash';
    if(/^gemini-[a-z0-9.-]+$/.test(model))try{
      const resp=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',{
        method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
        signal:AbortSignal.timeout(12000),cache:'no-store',
        body:JSON.stringify({contents:[{parts:[{text:'Create clinically precise, ordered headings for each numbered medical lecture excerpt. Return JSON object {"topics":["..."]}, exactly '+portions.length+' headings. Preserve pathophysiology, pharmacology mechanisms, clinical significance and evidence. Do not summarize the original text; it remains stored in full.\n'+portions.map((part,i)=>(i+1)+'. '+part.slice(0,540)).join('\n').slice(0,22000)}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1,maxOutputTokens:1500}})
      });
      if(resp.ok){
        const data=await resp.json();
        const parsed=JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text||'{}');
        if(Array.isArray(parsed.topics)&&parsed.topics.length===portions.length&&parsed.topics.every((s:unknown)=>typeof s==='string'&&s.length<120))enriched=parsed.topics;
      }
    }catch{/* Keep the source-preserving map when free-tier Gemini is throttled. */}
  }
  const chunks=portions.map((content,i)=>{
    const title=(enriched?.[i]||titles[i]).replace(/[\r\n]+/g,' ').slice(0,110);
    return{id:'chunk-'+(i+1),title,content,visual:visualFor(title,content)};
  });
  return{version:1,sourceFileName,mappedBy:enriched?'gemini':'source-preserving',syllabus:chunks.map(c=>({topic:c.title,chunkIds:[c.id]})),chunks};
}
