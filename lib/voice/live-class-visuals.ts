import type { PhysiologyPreset } from '@/components/PhysiologySimulator';

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storageOrigin = configuredSupabaseUrl
  ? new URL(configuredSupabaseUrl).origin
  : 'https://hixvbcrrklyajhkyliay.supabase.co';
const assetRoot = `${storageOrigin}/storage/v1/object/public/medical-models`;

export const LIVE_CLASS_MODEL_ASSETS = {
  kidneys: `${assetRoot}/organs/Kidneys.glb`,
  bloodCellMorphology: `${assetRoot}/cytology/Blood_Cell_Morphology.glb`,
  leukocyteMorphology: `${assetRoot}/cytology/Leukocyte_Morphology.glb`,
  leukemiaBlastMorphology: `${assetRoot}/pathology/Leukemia_Blast_Morphology.glb`,
  epithelialDysplasia: `${assetRoot}/histology/Epithelial_Dysplasia.glb`,
  atherosclerosis: `${assetRoot}/pathology/Atherosclerosis.glb`,
  tumorMicroenvironment: `${assetRoot}/pathology/Tumor_Microenvironment.glb`,
  granulomatousInflammation: `${assetRoot}/pathology/Granulomatous_Inflammation.glb`,
  fattyLiver: `${assetRoot}/histology/Fatty_Liver.glb`,
  gramCellEnvelope: `${assetRoot}/concepts/v1/microbiology/Gram_Cell_Envelope.glb`,
  bacterialEndospore: `${assetRoot}/concepts/v1/microbiology/Bacterial_Endospore.glb`,
  envelopedVirus: `${assetRoot}/concepts/v1/microbiology/Enveloped_Virus.glb`,
  septateFungalHypha: `${assetRoot}/concepts/v1/microbiology/Septate_Fungal_Hypha.glb`,
  bacterialBiofilm: `${assetRoot}/concepts/v1/microbiology/Bacterial_Biofilm.glb`,
  antibodyAntigen: `${assetRoot}/concepts/v1/immunology/Antibody_Antigen_Binding.glb`,
  opsonisation: `${assetRoot}/concepts/v1/immunology/Opsonisation_Phagocytosis.glb`,
  megaloblastic: `${assetRoot}/concepts/v1/haematology/Megaloblastic_Maturation.glb`,
  plateletFibrin: `${assetRoot}/concepts/v1/haematology/Platelet_Fibrin_Thrombus.glb`,
  acuteInflammation: `${assetRoot}/concepts/v1/pathology/Acute_Inflammation_Diapedesis.glb`,
  coagulativeNecrosis: `${assetRoot}/concepts/v1/pathology/Coagulative_Necrosis.glb`,
  apoptosis: `${assetRoot}/concepts/v1/pathology/Apoptosis_Blebbing.glb`,
  thrombosisEmbolism: `${assetRoot}/concepts/v1/pathology/Thrombosis_Embolism.glb`,
  glomerularInflammation: `${assetRoot}/concepts/v1/pathology/Glomerular_Inflammation.glb`,
  cirrhosis: `${assetRoot}/concepts/v1/pathology/Cirrhosis_Fibrous_Septa.glb`,
  invasiveCarcinoma: `${assetRoot}/concepts/v1/pathology/Invasive_Epithelial_Carcinoma.glb`,
  cholinergicSynapse: `${assetRoot}/concepts/v1/pharmacology/Cholinergic_Synapse.glb`,
  receptorOccupancy: `${assetRoot}/concepts/v1/pharmacology/Receptor_Agonist_Antagonist.glb`,
  sodiumChannelBlockade: `${assetRoot}/concepts/v1/pharmacology/Voltage_Gated_Sodium_Channel.glb`,
  hraLung: `${assetRoot}/hra-v25/lung.glb`,
  hraHeart: `${assetRoot}/hra-v25/heart.glb`,
  hraLiver: `${assetRoot}/hra-v25/liver.glb`,
  hraKidney: `${assetRoot}/hra-v25/kidney.glb`,
  hraBrain: `${assetRoot}/hra-v25/brain.glb`,
  hraPancreas: `${assetRoot}/hra-v25/pancreas.glb`,
  hraSpleen: `${assetRoot}/hra-v25/spleen.glb`,
  hraLymphNode: `${assetRoot}/hra-v25/lymph-node.glb`,
  hraLargeIntestine: `${assetRoot}/hra-v25/large-intestine.glb`,
  hraSmallIntestine: `${assetRoot}/hra-v25/small-intestine.glb`,
  hraSkin: `${assetRoot}/hra-v25/skin.glb`,
  hraBladder: `${assetRoot}/hra-v25/urinary-bladder.glb`,
  hraUterus: `${assetRoot}/hra-v25/uterus.glb`,
  hraProstate: `${assetRoot}/hra-v25/prostate.glb`,
  hraThymus: `${assetRoot}/hra-v25/thymus.glb`,
  hraSpinalCord: `${assetRoot}/hra-v25/spinal-cord.glb`,
  hraTrachea: `${assetRoot}/hra-v25/trachea.glb`,
  hraMainBronchus: `${assetRoot}/hra-v25/main-bronchus.glb`,
  hraPlacenta: `${assetRoot}/hra-v25/placenta.glb`,
  hraRenalPelvis: `${assetRoot}/hra-v25/renal-pelvis.glb`,
  hraEye: `${assetRoot}/hra-v25/eye.glb`,
  hraBloodVessels: `${assetRoot}/hra-v25/blood-vasculature.glb`,
  hraMammaryGland: `${assetRoot}/hra-v25/mammary-gland.glb`,
  hraLarynx: `${assetRoot}/hra-v25/larynx.glb`,
  hraUreter: `${assetRoot}/hra-v25/ureter.glb`,
  hraKnee: `${assetRoot}/hra-v25/knee.glb`,
  hraPelvis: `${assetRoot}/hra-v25/pelvis.glb`,
  hraFallopianTube: `${assetRoot}/hra-v25/fallopian-tube.glb`,
} as const;

export type MoleculeAsset = {
  modelUrl: string;
  pdbId: string;
  title: string;
  ligand: string;
  note: string;
};

export const LIVE_CLASS_MOLECULE_ASSETS = {
  beta2Adrenergic: {
    modelUrl: `${assetRoot}/pharmacology/2RH1.pdb`,
    pdbId: '2RH1',
    title: 'β2-adrenergic receptor',
    ligand: 'carazolol',
    note: 'The displayed β-blocker ligand is carazolol; do not label it as another drug.',
  },
  acetylcholinesterase: {
    modelUrl: `${assetRoot}/pharmacology/4EY7.pdb`,
    pdbId: '4EY7',
    title: 'Acetylcholinesterase',
    ligand: 'donepezil',
    note: 'Human acetylcholinesterase bound to donepezil.',
  },
  dihydrofolateReductase: {
    modelUrl: `${assetRoot}/pharmacology/1U72.pdb`,
    pdbId: '1U72',
    title: 'Dihydrofolate reductase',
    ligand: 'methotrexate',
    note: 'Dihydrofolate reductase complex illustrating methotrexate binding.',
  },
} as const satisfies Record<string, MoleculeAsset>;

export type LiveClassMoleculeAsset = (typeof LIVE_CLASS_MOLECULE_ASSETS)[keyof typeof LIVE_CLASS_MOLECULE_ASSETS];

export type VisualContext =
  | { type: 'whiteboard'; topic: string; markdown?: string }
  | { type: 'model'; modelUrl: string; structureId?: string; highlightColor?: string; note?: string; title?: string; category?: string }
  | { type: 'molecule'; modelUrl: string; pdbId: string; title: string; ligand: string; note: string }
  | { type: 'simulation'; preset: PhysiologyPreset; title: string }
  | { type: 'media'; mediaUrl: string; caption?: string };

const MODEL_LABELS: Record<string, string> = {
  [LIVE_CLASS_MODEL_ASSETS.kidneys]: 'Kidney, Male, Right',
  [LIVE_CLASS_MODEL_ASSETS.bloodCellMorphology]: 'Blood-cell morphology · schematic',
  [LIVE_CLASS_MODEL_ASSETS.leukocyteMorphology]: 'Leukocyte morphology · schematic',
  [LIVE_CLASS_MODEL_ASSETS.leukemiaBlastMorphology]: 'Leukaemia blast morphology · schematic',
  [LIVE_CLASS_MODEL_ASSETS.epithelialDysplasia]: 'Epithelial dysplasia · schematic',
  [LIVE_CLASS_MODEL_ASSETS.atherosclerosis]: 'Atherosclerosis · schematic',
  [LIVE_CLASS_MODEL_ASSETS.tumorMicroenvironment]: 'Tumour microenvironment · schematic',
  [LIVE_CLASS_MODEL_ASSETS.granulomatousInflammation]: 'Granulomatous inflammation · schematic',
  [LIVE_CLASS_MODEL_ASSETS.fattyLiver]: 'Fatty-liver steatosis · schematic',
  [LIVE_CLASS_MODEL_ASSETS.gramCellEnvelope]: 'Gram-positive and Gram-negative cell envelopes · schematic',
  [LIVE_CLASS_MODEL_ASSETS.bacterialEndospore]: 'Bacterial endospore and cortex · schematic',
  [LIVE_CLASS_MODEL_ASSETS.envelopedVirus]: 'Enveloped virus and nucleocapsid · schematic',
  [LIVE_CLASS_MODEL_ASSETS.septateFungalHypha]: 'Septate fungal hypha and branching · schematic',
  [LIVE_CLASS_MODEL_ASSETS.bacterialBiofilm]: 'Bacterial biofilm and extracellular matrix · schematic',
  [LIVE_CLASS_MODEL_ASSETS.antibodyAntigen]: 'Antibody structure and antigen binding · schematic',
  [LIVE_CLASS_MODEL_ASSETS.opsonisation]: 'Opsonisation and phagocyte recognition · schematic',
  [LIVE_CLASS_MODEL_ASSETS.megaloblastic]: 'Megaloblastic erythropoiesis · schematic',
  [LIVE_CLASS_MODEL_ASSETS.plateletFibrin]: 'Platelet–fibrin thrombus · schematic',
  [LIVE_CLASS_MODEL_ASSETS.acuteInflammation]: 'Acute inflammation and neutrophil diapedesis · schematic',
  [LIVE_CLASS_MODEL_ASSETS.coagulativeNecrosis]: 'Coagulative necrosis and tissue cell outlines · schematic',
  [LIVE_CLASS_MODEL_ASSETS.apoptosis]: 'Apoptosis, blebbing and nuclear fragments · schematic',
  [LIVE_CLASS_MODEL_ASSETS.thrombosisEmbolism]: 'Thrombosis and embolism · schematic',
  [LIVE_CLASS_MODEL_ASSETS.glomerularInflammation]: 'Glomerular inflammation and capillary loops · schematic',
  [LIVE_CLASS_MODEL_ASSETS.cirrhosis]: 'Cirrhosis, regenerative nodules and fibrosis · schematic',
  [LIVE_CLASS_MODEL_ASSETS.invasiveCarcinoma]: 'Epithelial carcinoma and basement-membrane invasion · schematic',
  [LIVE_CLASS_MODEL_ASSETS.cholinergicSynapse]: 'Cholinergic synapse and acetylcholine transmission · schematic',
  [LIVE_CLASS_MODEL_ASSETS.receptorOccupancy]: 'Agonists and antagonists at receptors · schematic',
  [LIVE_CLASS_MODEL_ASSETS.sodiumChannelBlockade]: 'Voltage-gated sodium-channel blockade · schematic',
  [LIVE_CLASS_MODEL_ASSETS.hraLung]: 'Lung, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraHeart]: 'Heart, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraLiver]: 'Liver, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraKidney]: 'Kidney, left, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraBrain]: 'Brain, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraPancreas]: 'Pancreas, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraSpleen]: 'Spleen, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraLymphNode]: 'Lymph node, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraLargeIntestine]: 'Large intestine, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraSmallIntestine]: 'Small intestine, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraSkin]: 'Skin, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraBladder]: 'Urinary bladder, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraUterus]: 'Uterus, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraProstate]: 'Prostate, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraThymus]: 'Thymus, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraSpinalCord]: 'Spinal cord, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraTrachea]: 'Trachea, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraMainBronchus]: 'Main bronchus, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraPlacenta]: 'Placenta, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraRenalPelvis]: 'Renal pelvis, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraEye]: 'Eye, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraBloodVessels]: 'Blood vasculature, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraMammaryGland]: 'Mammary gland, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraLarynx]: 'Larynx, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraUreter]: 'Ureter, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraKnee]: 'Knee, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraPelvis]: 'Pelvis, reference anatomy · expert-reviewed HRA',
  [LIVE_CLASS_MODEL_ASSETS.hraFallopianTube]: 'Fallopian tube, reference anatomy · expert-reviewed HRA',
};

export function getLiveClassModelLabel(modelUrl: string) {
  return MODEL_LABELS[modelUrl.split(/[?#]/, 1)[0]] ?? 'Medical model';
}

export function getAnatomyModelLabel(modelUrl: string) {
  return getLiveClassModelLabel(modelUrl);
}

function isAllowedUrl(modelUrl: string, approvedUrls: string[]) {
  try {
    const candidate = new URL(modelUrl);
    if (candidate.protocol !== 'https:') return false;
    return approvedUrls.some((approvedUrl) => {
      const approved = new URL(approvedUrl);
      return candidate.origin === approved.origin && candidate.pathname === approved.pathname;
    });
  } catch {
    return false;
  }
}

export function isApprovedMedicalModelUrl(modelUrl: string) {
  return isAllowedUrl(modelUrl, Object.values(LIVE_CLASS_MODEL_ASSETS));
}

export function getMoleculeAsset(modelUrl: string): LiveClassMoleculeAsset | undefined {
  return Object.values(LIVE_CLASS_MOLECULE_ASSETS).find((asset) =>
    asset.modelUrl === modelUrl.split(/[?#]/, 1)[0],
  );
}

export function isApprovedMoleculeModelUrl(modelUrl: string) {
  return isAllowedUrl(modelUrl, Object.values(LIVE_CLASS_MOLECULE_ASSETS).map((asset) => asset.modelUrl));
}

function normalizeSpeech(speech: string) {
  return speech.replace(/\s+/g, ' ').trim().slice(0, 5000);
}

function extractTopic(speech: string, courseName: string) {
  const namedTopics: Array<[RegExp, string]> = [
    [/\b(liver function (?:tests?|panel)|lfts?|bilirubin|transaminases?|\balt\b|\bast\b|\bggt\b|\balp\b|alkaline phosphatase|albumin)\b/i, 'Chemical pathology · liver function'],
    [/\b(renal function test|urea and electrolytes|u\s*&\s*e|creatinine|estimated glomerular filtration|\begfr\b)\b/i, 'Chemical pathology · renal function and electrolytes'],
    [/\b(arterial blood gas|\babg\b|blood gas|acid[-– ]base|anion gap|bicarbonate|metabolic acidosis|metabolic alkalosis)\b/i, 'Chemical pathology · acid–base balance'],
    [/\b(thyroid function test|\btfts?\b|\btsh\b|free t[34]|thyroxine|triiodothyronine)\b/i, 'Chemical pathology · thyroid function'],
    [/\b(lipid profile|cholesterol|triglycerides?|\bldl\b|\bhdl\b)\b/i, 'Chemical pathology · lipid profile'],
    [/\b(hba1c|glycated haemoglobin|glycated hemoglobin|fasting glucose|\bogtt\b|glucose tolerance|blood glucose)\b/i, 'Chemical pathology · glucose regulation'],
    [/\b(electrolytes?|serum sodium|serum potassium|serum calcium|phosphate|magnesium)\b/i, 'Chemical pathology · electrolytes'],
    [/\b(troponin|ck[- ]?mb|creatine kinase|amylase|lipase|procalcitonin|c-reactive protein|\bcrp\b)\b/i, 'Chemical pathology · biomarkers and enzymes'],
    [/\b(chemical pathology|clinical chemistry|clinical biochemistry|laboratory medicine)\b/i, 'Chemical pathology'],
    [/\b(pharmacokinetic|pharmacodynamic|\badme\b|dose[- ]response|therapeutic index|bioavailability|drug clearance|half[- ]life|drug interaction)\b/i, 'Pharmacology · drug disposition and response'],
    [/\b(warfarin|aspirin|heparin|insulin|metformin|penicillin|amoxicillin|paracetamol|acetaminophen|morphine|salbutamol|albuterol|adrenaline|epinephrine|atorvastatin|simvastatin)\b/i, 'Pharmacology · drug mechanism and clinical use'],
    [/\b(pharmacology|agonist|antagonist|enzyme inhibitor|drug receptor|mechanism of action)\b/i, 'Pharmacology mechanism'],
    [/\bantibod(?:y|ies)\b/i, 'Antibody production'],
    [/\bantigen(?:s)?\b/i, 'Antigens and immune response'],
    [/\b(autoimmune|autoimmunity)\b/i, 'Autoimmune disorders'],
    [/\b(leuk(?:a?emias?|a?emics?))\b/i, 'Leukaemia'],
    [/\b(haemostasis|hemostasis|coagulation)\b/i, 'Haemostasis and coagulation'],
    [/\b(erythrocyte|red blood cell|haemoglobin|hemoglobin|anaemia|anemia)\b/i, 'Red blood cells and oxygen transport'],
    [/\b(neutrophil|lymphocyte|monocyte|eosinophil|basophil)\b/i, 'Blood-cell function'],
    [/\b(inflammation|cytokine|complement)\b/i, 'Inflammation and immune signalling'],
    [/\b(apoptosis|apoptotic|programmed cell death|necrosis|necrotic cell death)\b/i, 'Cell injury and cell death'],
  ];
  for (const [pattern, label] of namedTopics) {
    if (pattern.test(speech)) return label;
  }

  const firstSentence = speech.split(/(?<=[.!?])\s+/)[0]?.replace(/^[-–—•\s]+/, '').trim() || '';
  if (firstSentence && firstSentence.length >= 4) return firstSentence.length > 66 ? `${firstSentence.slice(0, 63).trimEnd()}…` : firstSentence;
  return courseName || 'Live lesson concept';
}

export function transcriptToWhiteboardMarkdown(speech: string) {
  const statements = normalizeSpeech(speech)
    .split(/(?<=[.!?])\s+/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (statements.length === 0) {
    const fallback = normalizeSpeech(speech).replace(/^[-–—•\s]+/, '').trim();
    return fallback.length >= 4 ? `### Key idea\n\n${fallback}` : '';
  }
  return `### The tutor's explanation\n\n${statements.map((statement, index) => `- **${index + 1}.** ${statement}`).join('\n')}`;
}

const SPECIFIC_WHITEBOARD_TOPICS = /^(chemical pathology|pharmacology|antibody production|antigens and immune response|autoimmune disorders|leukaemia|haemostasis and coagulation|red blood cells and oxygen transport|blood-cell function|inflammation and immune signalling|cell injury and cell death)\b/i;

const FILLER_ONLY_UTTERANCES = new Set([
  'hi', 'hello', 'hey', 'hello there', 'hey there', 'good morning', 'good afternoon', 'good evening',
  'can you hear me', 'are you there', 'what would you like to learn', 'what topic should we cover',
  'okay', 'ok', 'yes', 'yeah', 'yep', 'no', 'sure', 'sure thing', 'great', 'good', 'right', 'exactly', 'correct',
  'absolutely', 'definitely', 'thanks', 'thank you', 'thanks for asking', 'great question', 'good question',
  'that is a good question', 'that is a great question', "that's a good question", "that's a great question",
  "that's right", 'that is right', "you're right", "you're correct", 'perfect', 'brilliant', 'interesting', 'fair enough', 'i see', 'got it',
  'understood', 'i understand', 'i agree', 'i think so', 'i suppose', 'sounds good', 'looks good', 'makes sense',
  'noted', 'true', 'go ahead', 'please continue', 'just a moment', 'one moment', 'just a second', 'here we go',
  'i can hear you', 'can you repeat that', "let's move on", 'good one', 'very good', 'you know',
  'uh', 'um', 'erm', 'hmm', 'mm', 'mm hmm', 'uh huh', 'oh', 'ah', 'well',
]);
const NON_TEACHING_UTTERANCE_PATTERNS = [
  /^(?:i(?:'m| am)\s+)?listening(?:\s+to\s+you)?[.!\s]*$/i,
  /^(?:no problem|sure thing|okay|ok|alright|all right),?\s+(?:i(?:'ll| will)|let(?:'s| us))\s+(?:keep|move|continue|go)\b.*$/i,
  /^(?:i(?:'m| am)\s+)?ready\s+to\s+(?:listen|help|continue)\b.*$/i,
  /^(?:let(?:'s| us)|we(?:'ll| will))\s+(?:move|continue|go)\s+(?:on|forward)\b.*$/i,
  /^(?:give me|hold on|just)\s+(?:a|one)\s+(?:moment|second)\b.*$/i,
];

const NONCONCEPT_SHORT_WORDS = new Set([
  'a', 'an', 'the', 'i', 'you', 'we', 'they', 'he', 'she', 'it', 'this', 'that', 'these', 'those',
  'what', 'which', 'where', 'when', 'who', 'why', 'how', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'do', 'does', 'did', 'can', 'could', 'would', 'should', 'will', 'have', 'has', 'had', 'to', 'of', 'for', 'with',
  'on', 'in', 'at', 'by', 'and', 'or', 'but', 'so', 'then', 'than', 'yes', 'no', 'yeah', 'yep', 'ok', 'okay',
  'sure', 'right', 'exactly', 'correct', 'good', 'great', 'thanks', 'thank', 'hello', 'hi', 'hey', 'please', 'well',
  'just', 'like', 'make', 'makes', 'sense', 'think', 'guess', 'maybe', 'actually', 'point', 'question', 'any',
  'same', 'know', 'one', 'very', 'hear', 'repeat', 'move', 'true',
]);

export function shouldApplyTutorTranscriptVisual(speech: string, visual: VisualContext) {
  const text = normalizeSpeech(speech);
  const normalized = text.toLowerCase().replace(/[’]/g, "'").replace(/[.!?,;:]+/g, '').replace(/\s+/g, ' ').trim();
  if (!normalized || FILLER_ONLY_UTTERANCES.has(normalized) || NON_TEACHING_UTTERANCE_PATTERNS.some((pattern) => pattern.test(text))) return false;
  const words = normalized.match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) ?? [];
  if (visual.type !== 'whiteboard' || SPECIFIC_WHITEBOARD_TOPICS.test(visual.topic)) return true;
  const hasShortConcept = text.length >= 4 && words.length <= 4 && words.some((word) => !NONCONCEPT_SHORT_WORDS.has(word));
  return hasShortConcept || (text.length >= 42 && words.length >= 6);
}

function modelContext(key: keyof typeof LIVE_CLASS_MODEL_ASSETS): VisualContext {
  return { type: 'model', modelUrl: LIVE_CLASS_MODEL_ASSETS[key] };
}

function moleculeContext(asset: LiveClassMoleculeAsset): VisualContext {
  return { type: 'molecule', ...asset };
}

export function inferLiveClassVisual(speech: string, courseName: string): VisualContext {
  const text = normalizeSpeech(speech);
  const lower = text.toLowerCase();

  const hasHeartRate = /\bheart rate\b|\bhr\b/.test(lower);
  const hasStrokeVolume = /\bstroke volume\b|\bsv\b/.test(lower);
  if (/\bcardiac output\b|\bcardiac index\b/.test(lower) || (hasHeartRate && hasStrokeVolume)) {
    return { type: 'simulation', preset: 'cardiac_output', title: 'Cardiac output' };
  }
  if (/\bmean arterial pressure\b|\bmap\b.*\bpressure\b|\bsystolic\b.*\bdiastolic\b/.test(lower)) {
    return { type: 'simulation', preset: 'mean_arterial_pressure', title: 'Mean arterial pressure' };
  }
  if (/\balveolar ventilation\b|\bdead space\b|\btidal volume\b.*\b(respiratory rate|ventilation)\b/.test(lower)) {
    return { type: 'simulation', preset: 'alveolar_ventilation', title: 'Alveolar ventilation' };
  }

  const handsOnLabs: Array<[RegExp, PhysiologyPreset, string]> = [
    [/\\b(?:henderson[-– ]hasselbalch|acid[-– ]base balance|acid[-– ]base equation|respiratory acidosis|metabolic acidosis|respiratory alkalosis|metabolic alkalosis)\\b/i, 'acid_base_balance', 'Acid–base balance'],
    [/\\b(?:anion gap|unmeasured anions)\\b/i, 'anion_gap', 'Anion gap'],
    [/\\b(?:drug half[-– ]life|elimination half[-– ]life|first[-– ]order elimination|half[-– ]life of a drug)\\b/i, 'drug_half_life', 'Drug elimination'],
    [/\\b(?:competitive antagonism|competitive antagonist|receptor occupancy|dose[-– ]response curve|ec50|e\\s*max)\\b/i, 'competitive_antagonism', 'Competitive antagonism'],
    [/\\b(?:arterial oxygen content|oxygen content of blood|calculated cao2|oxygen carrying capacity)\\b/i, 'oxygen_content', 'Arterial oxygen content'],
    [/\\b(?:renal clearance equation|calculate renal clearance|solute clearance|urine plasma clearance)\\b/i, 'renal_clearance', 'Renal clearance'],
  ];
  for (const [pattern, preset, title] of handsOnLabs) {
    if (pattern.test(text)) return { type: 'simulation', preset, title };
  }

  const chemicalPathologyTopics: Array<[RegExp, string]> = [
    [/\b(liver function (?:tests?|panel)|lfts?|bilirubin|transaminases?|\balt\b|\bast\b|\bggt\b|\balp\b|alkaline phosphatase|albumin)\b/i, 'Chemical pathology · liver function'],
    [/\b(renal function test|urea and electrolytes|u\s*&\s*e|creatinine|estimated glomerular filtration|\begfr\b)\b/i, 'Chemical pathology · renal function and electrolytes'],
    [/\b(arterial blood gas|\babg\b|blood gas|acid[-– ]base|anion gap|bicarbonate|metabolic acidosis|metabolic alkalosis)\b/i, 'Chemical pathology · acid–base balance'],
    [/\b(thyroid function test|\btfts?\b|\btsh\b|free t[34]|thyroxine|triiodothyronine)\b/i, 'Chemical pathology · thyroid function'],
    [/\b(lipid profile|cholesterol|triglycerides?|\bldl\b|\bhdl\b)\b/i, 'Chemical pathology · lipid profile'],
    [/\b(hba1c|glycated haemoglobin|glycated hemoglobin|fasting glucose|\bogtt\b|glucose tolerance|blood glucose)\b/i, 'Chemical pathology · glucose regulation'],
    [/\b(electrolytes?|serum sodium|serum potassium|serum calcium|phosphate|magnesium)\b/i, 'Chemical pathology · electrolytes'],
    [/\b(troponin|ck[- ]?mb|creatine kinase|amylase|lipase|procalcitonin|c-reactive protein|\bcrp\b)\b/i, 'Chemical pathology · biomarkers and enzymes'],
    [/\b(chemical pathology|clinical chemistry|clinical biochemistry|laboratory medicine)\b/i, 'Chemical pathology'],
  ];
  for (const [pattern, topic] of chemicalPathologyTopics) {
    if (pattern.test(text)) return { type: 'whiteboard', topic, markdown: transcriptToWhiteboardMarkdown(text) };
  }

  if (/\b(pharmacokinetic|pharmacodynamic|\badme\b|dose[- ]response|therapeutic index|bioavailability|drug clearance|half[- ]life|drug interaction)\b/i.test(text)) {
    return { type: 'whiteboard', topic: 'Pharmacology · drug disposition and response', markdown: transcriptToWhiteboardMarkdown(text) };
  }

  if (/\b(donepezil|acetylcholinesterase|cholinesterase|ache)\b/i.test(text)) {
    return moleculeContext(LIVE_CLASS_MOLECULE_ASSETS.acetylcholinesterase);
  }
  if (/\b(methotrexate|dihydrofolate reductase|dhfr|antifolate)\b/i.test(text)) {
    return moleculeContext(LIVE_CLASS_MOLECULE_ASSETS.dihydrofolateReductase);
  }
  if (/\b(beta.?blocker|β.?blocker|carazolol|propranolol|carvedilol|beta.?2.?adrenergic|β2.?adrenergic|adrenoceptor)\b/i.test(text)) {
    return moleculeContext(LIVE_CLASS_MOLECULE_ASSETS.beta2Adrenergic);
  }

  // New concept models are narrow visual matches; they do not change speech,
  // tutor turn-taking, simulation timing or lesson progression.
  const clinicalConcepts: Array<[RegExp, keyof typeof LIVE_CLASS_MODEL_ASSETS]> = [
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
  for (const [pattern, key] of clinicalConcepts) {
    if (pattern.test(text)) return modelContext(key);
  }

  const clinicalReferenceOrgans: Array<[RegExp, keyof typeof LIVE_CLASS_MODEL_ASSETS]> = [
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
  ];
  for (const [pattern, key] of clinicalReferenceOrgans) {
    if (pattern.test(text)) return modelContext(key);
  }

  if (/\b(sickle cell|sickle-cell|drepanocytosis|erythrocyte|red blood cell|haemoglobin|hemoglobin|oxygen transport)\b/i.test(text)) {
    return modelContext('bloodCellMorphology');
  }
  if (/\bacute\s+(?:(?:myeloid|myelogenous|lymphoblastic|lymphocytic)\s+)?leuk(?:a?emias?)\b|\b(myeloblast|lymphoblast|blast crisis)\b/i.test(text)) {
    return modelContext('leukemiaBlastMorphology');
  }
  if (/\b(neutrophil|lymphocyte|monocyte|eosinophil|basophil|blood smear|white blood cell|leukocyte|granulocyte)\b/i.test(text)) {
    return modelContext('leukocyteMorphology');
  }
  if (/\b(atheroscleros(?:is|tic)|atheroma|atherosclerotic plaque|arterial plaque|coronary artery disease|arterial stenosis)\b/i.test(text)) {
    return modelContext('atherosclerosis');
  }
  if (/\b(epitheli(?:um|al)|histology|dysplasia|metaplasia|cervical intraepithelial|pap smear)\b/i.test(text)) {
    return modelContext('epithelialDysplasia');
  }
  if (/\b(tumou?r|carcinoma|neoplasm|metastasis|angiogenesis|tumou?r microenvironment)\b/i.test(text)) {
    return modelContext('tumorMicroenvironment');
  }
  if (/\b(granuloma|granulomatous inflammation|epithelioid macrophage|giant cell|caseous necrosis)\b/i.test(text)) {
    return modelContext('granulomatousInflammation');
  }
  if (/\b(fatty liver|steatosis|steatotic|hepatic steatosis|lipid vacuole)\b/i.test(text)) {
    return modelContext('fattyLiver');
  }

  const specificOrgans: Array<{ key: keyof typeof LIVE_CLASS_MODEL_ASSETS; pattern: RegExp; structure?: RegExp }> = [
    { key: 'kidneys', pattern: /\b(kidney|renal|nephron|glomerul(?:us|i|ar))\b/i, structure: /\b(nephron|glomerul(?:us|i|ar)|renal tubule)\b/i },
  ];
  for (const organ of specificOrgans) {
    if (!organ.pattern.test(text)) continue;
    const structureId = text.match(organ.structure ?? /$^/i)?.[0];
    return { type: 'model', modelUrl: LIVE_CLASS_MODEL_ASSETS[organ.key], ...(structureId ? { structureId } : {}) };
  }


  return {
    type: 'whiteboard',
    topic: extractTopic(text, courseName),
    markdown: transcriptToWhiteboardMarkdown(text),
  };
}
