/**
 * Prepare source-preserving thematic chunks before the LiveKit voice loop.
 * Gemini enriches the syllabus only; complete clinical text stays in each chunk.
 */
import { LIVE_CLASS_MODEL_ASSETS, LIVE_CLASS_MOLECULE_ASSETS } from '@/lib/voice/live-class-visuals';

type Visual = {type:'whiteboard'|'model'|'molecule';topic:string;markdown?:string;modelKey?:string;note?:string};
function visualFor(title:string,content:string):Visual {
  const subject=(title+' '+content.slice(0,400)).toLowerCase();
  const approvedConcepts:[RegExp,keyof typeof LIVE_CLASS_MODEL_ASSETS][]=[
    [/\b(?:gram[- ]positive|gram[- ]negative|peptidoglycan|lipopolysaccharide|outer bacterial membrane)\b/i, 'gramCellEnvelope'],
    [/\b(?:bacterial endospores?|endospore coat|spore formation|sporulation)\b/i, 'bacterialEndospore'],
    [/\b(?:viral envelope|enveloped virus|viral capsid|nucleocapsid|viral glycoprotein spikes?)\b/i, 'envelopedVirus'],
    [/\b(?:septate hyphae?|fungal hyphae?|hyphal branching|aspergillus morphology)\b/i, 'septateFungalHypha'],
    [/\b(?:biofilm|extracellular polymeric substances?)\b/i, 'bacterialBiofilm'],
    [/\b(?:antibody structure|immunoglobulin structure|antigen[- ]antibody binding|fab region|fc region|antibody binding site)\b/i, 'antibodyAntigen'],
    [/\b(?:opsoni[sz]ation|phagocytosis|phagocytic engulfment|c3b opsonin)\b/i, 'opsonisation'],
    [/\b(?:megaloblastic|megaloblasts?|nuclear[- ]cytoplasmic asynchrony)\b/i, 'megaloblastic'],
    [/\b(?:thrombosis|thromboembolism|embolism|vascular occlusion|thromboemboli)\b/i, 'thrombosisEmbolism'],
    [/\b(?:platelet aggregation|fibrin mesh|fibrin network|platelet plug|primary haemostasis)\b/i, 'plateletFibrin'],
    [/\b(?:acute inflammation|diapedesis|neutrophil extravasation|leukocyte rolling|leucocyte adhesion|vascular changes in inflammation)\b/i, 'acuteInflammation'],
    [/\b(?:coagulative necrosis|ischaemic necrosis|ischemic necrosis)\b/i, 'coagulativeNecrosis'],
    [/\b(?:apoptosis|apoptotic bodies|apoptotic cell|membrane blebbing)\b/i, 'apoptosis'],
    [/\b(?:glomerulonephritis|glomerular inflammation|mesangial proliferation|glomerular capillary)\b/i, 'glomerularInflammation'],
    [/\b(?:cirrhosis|fibrous septa|regenerative nodules?|hepatic fibrosis)\b/i, 'cirrhosis'],
    [/\b(?:invasive carcinoma|tumou?r invasion|basement membrane invasion|malignant cell invasion)\b/i, 'invasiveCarcinoma'],
    [/\b(?:cholinergic synapse|acetylcholine release|neuromuscular junction|synaptic acetylcholine)\b/i, 'cholinergicSynapse'],
    [/\b(?:agonist versus antagonist|agonists? and antagonists?|receptor occupancy|competitive antagonism|full agonists?|partial agonists?)\b/i, 'receptorOccupancy'],
    [/\b(?:voltage[- ]gated sodium channels?|sodium channel blockers?|local anaesthetic mechanism|lidocaine mechanism|lignocaine mechanism)\b/i, 'sodiumChannelBlockade'],
  ];
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
  models.push(
    [/lung anatomy|pulmonary lobes?|bronchial tree|bronchiectasis|emphysema|pneumonia|pulmonary fibrosis/i, 'hraLung'],
    [/heart anatomy|cardiac chambers?|myocardial infarction|endocarditis|pericarditis|cardiac valves?|valvular heart disease/i, 'hraHeart'],
    [/liver anatomy|portal triad|hepatic lobules?|hepatic blood supply|liver morphology/i, 'hraLiver'],
    [/kidney anatomy|hydronephrosis|renal cortex anatomy|renal medulla|renal calyces|renal pyramids/i, 'hraKidney'],
    [/brain anatomy|cerebral cortex|basal ganglia|cerebellar anatomy|intracranial haemorrhage|intracerebral haemorrhage|brain stem anatomy/i, 'hraBrain'],
    [/pancreas anatomy|pancreatitis|pancreatic islets?|islets of langerhans|pancreatic adenocarcinoma/i, 'hraPancreas'],
    [/spleen anatomy|splenic white pulp|splenic red pulp|splenomegaly|splenic infarct/i, 'hraSpleen'],
    [/lymph node architecture|lymphoma|lymphadenopathy|lymphadenitis|germinal centres?|germinal centers?/i, 'hraLymphNode'],
    [/colon anatomy|large intestine anatomy|ulcerative colitis|colorectal carcinoma|colon cancer|diverticulitis/i, 'hraLargeIntestine'],
    [/small intestine|crohn.?s disease|malabsorption|intestinal villi|ileal anatomy/i, 'hraSmallIntestine'],
    [/skin anatomy|epidermal layers|skin barrier|psoriasis|dermatitis/i, 'hraSkin'],
    [/urinary bladder|cystitis|urothelial carcinoma|bladder anatomy/i, 'hraBladder'],
    [/uterus anatomy|endometrium|endometrial carcinoma|uterine fibroids?|leiomyoma/i, 'hraUterus'],
    [/prostate anatomy|benign prostatic hyperplasia|prostate cancer|prostatic carcinoma/i, 'hraProstate'],
    [/thymus anatomy|thymoma|thymic involution|thymus gland/i, 'hraThymus'],
    [/spinal cord anatomy|anterior horn cells?|spinal pathways?|transverse myelitis|spinal cord lesion/i, 'hraSpinalCord'],
    [/trachea anatomy|tracheal stenosis|tracheal rings?|airway anatomy/i, 'hraTrachea'],
    [/main bronchi|main bronchus|bronchial anatomy|bronchial tree/i, 'hraMainBronchus'],
    [/placenta anatomy|placental circulation|placental abruption|placental infarction/i, 'hraPlacenta'],
    [/renal pelvis anatomy|ureteropelvic junction|renal calyces/i, 'hraRenalPelvis'],
    [/eye anatomy|glaucoma|retinal anatomy|optic disc|lens anatomy/i, 'hraEye'],
    [/vascular anatomy|arterial anatomy|arterial tree|venous system|vasculitis|systemic vessels?/i, 'hraBloodVessels'],
    [/breast anatomy|mammary gland|ductal carcinoma|breast carcinoma|lobular carcinoma/i, 'hraMammaryGland'],
    [/larynx anatomy|laryngeal cancer|vocal folds?|laryngeal cartilages?/i, 'hraLarynx'],
    [/ureter anatomy|ureteric stones?|ureteral calculi|ureteric obstruction/i, 'hraUreter'],
    [/knee anatomy|knee joint|knee osteoarthritis|meniscal injury/i, 'hraKnee'],
    [/pelvic skeleton|pelvic bones?|bony pelvis|pelvic anatomy/i, 'hraPelvis'],
    [/fallopian tube|ectopic pregnancy|salpingitis|tubal pregnancy/i, 'hraFallopianTube'],
  );
  const molecules:[RegExp,keyof typeof LIVE_CLASS_MOLECULE_ASSETS][]=[
    [/beta.?2 adrenergic receptor|carazolol/,'beta2Adrenergic'],
    [/acetylcholinesterase|donepezil/,'acetylcholinesterase'],
    [/dihydrofolate reductase|methotrexate/,'dihydrofolateReductase'],
  ];
  const note=content.replace(/\s+/g,' ').slice(0,245);
  for(const [pattern,modelKey] of molecules)if(pattern.test(subject))return{type:'molecule',topic:title,modelKey,note};
  for(const [pattern,modelKey] of approvedConcepts)if(pattern.test(subject))return{type:'model',topic:title,modelKey,note};
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
