import {createHash} from 'node:crypto';
import {sourceChunks} from '@/lib/curriculum/source-chunks';
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
  const ranges=sourceChunks(text);
  const portions=ranges.map(range=>range.content);
  const titles=portions.map((part,i)=>part.split(/\n/).map(s=>s.trim()).find(s=>s.length>5&&s.length<100)||'Lecture section '+(i+1));
  const chunks=portions.map((content,i)=>{
    const title=titles[i].replace(/[\r\n]+/g,' ').slice(0,110);
    return{id:'chunk-'+(i+1),title,content,visual:visualFor(title,content),start:ranges[i].start,end:ranges[i].end};
  });
  return{version:2,sourceFileName,mappedBy:'source-preserving',sourceCharacterCount:text.length,sourceSha256:createHash('sha256').update(text,'utf8').digest('hex'),syllabus:chunks.map(c=>({topic:c.title,chunkIds:[c.id]})),chunks};
}
