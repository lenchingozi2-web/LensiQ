import type { PhysiologyPreset } from '@/components/PhysiologySimulator';

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storageOrigin = configuredSupabaseUrl
  ? new URL(configuredSupabaseUrl).origin
  : 'https://hixvbcrrklyajhkyliay.supabase.co';
const assetRoot = `${storageOrigin}/storage/v1/object/public/medical-models`;

export const LIVE_CLASS_MODEL_ASSETS = {
  brain: `${assetRoot}/organs/Brain.glb`,
  heart: `${assetRoot}/organs/Heart.glb`,
  lungs: `${assetRoot}/organs/Lungs.glb`,
  liver: `${assetRoot}/organs/Liver.glb`,
  kidneys: `${assetRoot}/organs/Kidneys.glb`,
  integumentarySystem: `${assetRoot}/systems/Integumentary_System.glb`,
  skeletalSystem: `${assetRoot}/systems/Skeletal_System.glb`,
  muscularSystem: `${assetRoot}/systems/Muscular_System.glb`,
  nervousSystem: `${assetRoot}/systems/Nervous_System.glb`,
  endocrineSystem: `${assetRoot}/systems/Endocrine_System.glb`,
  cardiovascularSystem: `${assetRoot}/systems/Cardiovascular_System.glb`,
  lymphaticSystem: `${assetRoot}/systems/Lymphatic_System.glb`,
  respiratorySystem: `${assetRoot}/systems/Respiratory_System.glb`,
  digestiveSystem: `${assetRoot}/systems/Digestive_System.glb`,
  urinarySystem: `${assetRoot}/systems/Urinary_System.glb`,
  reproductiveSystem: `${assetRoot}/systems/Reproductive_System.glb`,
  bloodCellMorphology: `${assetRoot}/cytology/Blood_Cell_Morphology.glb`,
  leukocyteMorphology: `${assetRoot}/cytology/Leukocyte_Morphology.glb`,
  leukemiaBlastMorphology: `${assetRoot}/pathology/Leukemia_Blast_Morphology.glb`,
  epithelialDysplasia: `${assetRoot}/histology/Epithelial_Dysplasia.glb`,
  atherosclerosis: `${assetRoot}/pathology/Atherosclerosis.glb`,
  tumorMicroenvironment: `${assetRoot}/pathology/Tumor_Microenvironment.glb`,
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
  | { type: 'model'; modelUrl: string; structureId?: string; highlightColor?: string }
  | { type: 'molecule'; modelUrl: string; pdbId: string; title: string; ligand: string; note: string }
  | { type: 'simulation'; preset: PhysiologyPreset; title: string }
  | { type: 'media'; mediaUrl: string; caption?: string };

const MODEL_LABELS: Record<string, string> = {
  [LIVE_CLASS_MODEL_ASSETS.brain]: 'Brain',
  [LIVE_CLASS_MODEL_ASSETS.heart]: 'Heart',
  [LIVE_CLASS_MODEL_ASSETS.lungs]: 'Lungs',
  [LIVE_CLASS_MODEL_ASSETS.liver]: 'Liver',
  [LIVE_CLASS_MODEL_ASSETS.kidneys]: 'Kidney, Male, Right',
  [LIVE_CLASS_MODEL_ASSETS.integumentarySystem]: 'Integumentary system',
  [LIVE_CLASS_MODEL_ASSETS.skeletalSystem]: 'Skeletal system',
  [LIVE_CLASS_MODEL_ASSETS.muscularSystem]: 'Muscular system',
  [LIVE_CLASS_MODEL_ASSETS.nervousSystem]: 'Nervous system',
  [LIVE_CLASS_MODEL_ASSETS.endocrineSystem]: 'Endocrine system',
  [LIVE_CLASS_MODEL_ASSETS.cardiovascularSystem]: 'Cardiovascular system',
  [LIVE_CLASS_MODEL_ASSETS.lymphaticSystem]: 'Lymphatic system',
  [LIVE_CLASS_MODEL_ASSETS.respiratorySystem]: 'Respiratory system',
  [LIVE_CLASS_MODEL_ASSETS.digestiveSystem]: 'Digestive system',
  [LIVE_CLASS_MODEL_ASSETS.urinarySystem]: 'Urinary system',
  [LIVE_CLASS_MODEL_ASSETS.reproductiveSystem]: 'Reproductive system',
  [LIVE_CLASS_MODEL_ASSETS.bloodCellMorphology]: 'Blood-cell morphology · schematic',
  [LIVE_CLASS_MODEL_ASSETS.leukocyteMorphology]: 'Leukocyte morphology · schematic',
  [LIVE_CLASS_MODEL_ASSETS.leukemiaBlastMorphology]: 'Leukaemia blast morphology · schematic',
  [LIVE_CLASS_MODEL_ASSETS.epithelialDysplasia]: 'Epithelial dysplasia · schematic',
  [LIVE_CLASS_MODEL_ASSETS.atherosclerosis]: 'Atherosclerosis · schematic',
  [LIVE_CLASS_MODEL_ASSETS.tumorMicroenvironment]: 'Tumour microenvironment · schematic',
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

  const firstSentence = speech.split(/(?<=[.!?])\s+/)[0]?.trim() || '';
  if (firstSentence) return firstSentence.length > 66 ? `${firstSentence.slice(0, 63).trimEnd()}…` : firstSentence;
  return courseName || 'Live lesson concept';
}

export function transcriptToWhiteboardMarkdown(speech: string) {
  const statements = normalizeSpeech(speech)
    .split(/(?<=[.!?])\s+/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (statements.length === 0) return '';
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
  if (!normalized || FILLER_ONLY_UTTERANCES.has(normalized)) return false;
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

  const specificOrgans: Array<{ key: keyof typeof LIVE_CLASS_MODEL_ASSETS; pattern: RegExp; structure?: RegExp }> = [
    { key: 'brain', pattern: /\b(brain|cerebrum|cerebellum|brainstem|hippocamp(?:us|al)|cerebral cortex|cerebral)\b/i, structure: /\b(brainstem|cerebellum|hippocamp(?:us|al)|cerebral cortex|cerebrum)\b/i },
    { key: 'heart', pattern: /\b(heart|myocardium|myocardial|atrium|atria|ventricle|ventricular|valve)\b/i, structure: /\b(myocardium|atrium|atria|ventricle|ventricular|valve)\b/i },
    { key: 'lungs', pattern: /\b(lung|pulmonary|alveol(?:us|i|ar)|bronch(?:us|i|ial))\b/i, structure: /\b(alveol(?:us|i|ar)|bronch(?:us|i|ial))\b/i },
    { key: 'liver', pattern: /\b(liver|hepatic|hepatocyte|hepatobiliary)\b/i, structure: /\b(hepatocyte|hepatic lobule|bile duct)\b/i },
    { key: 'kidneys', pattern: /\b(kidney|renal|nephron|glomerul(?:us|i|ar))\b/i, structure: /\b(nephron|glomerul(?:us|i|ar)|renal tubule)\b/i },
  ];
  for (const organ of specificOrgans) {
    if (!organ.pattern.test(text)) continue;
    const structureId = text.match(organ.structure ?? /$^/i)?.[0];
    return { type: 'model', modelUrl: LIVE_CLASS_MODEL_ASSETS[organ.key], ...(structureId ? { structureId } : {}) };
  }

  const systems: Array<[keyof typeof LIVE_CLASS_MODEL_ASSETS, RegExp]> = [
    ['integumentarySystem', /\b(integument(?:ary)?|skin system|epidermis|dermis|cutaneous|hair follicle|skin appendage)\b/i],
    ['skeletalSystem', /\b(skeletal system|skeleton|osteology|bone tissue|joint anatomy|axial skeleton|appendicular skeleton)\b/i],
    ['muscularSystem', /\b(muscular system|skeletal muscle|myology|muscle group|muscle anatomy)\b/i],
    ['nervousSystem', /\b(nervous system|spinal cord|peripheral nerve|autonomic nervous system|neuroanatomy)\b/i],
    ['endocrineSystem', /\b(endocrine system|endocrine gland|hormone|pituitary|adrenal gland|thyroid gland|pancreatic islet)\b/i],
    ['cardiovascularSystem', /\b(cardiovascular system|circulatory system|blood vessel|arterial circulation|venous circulation)\b/i],
    ['lymphaticSystem', /\b(lymphatic system|lymph node|lymph vessel|immune system|lymphoid organ)\b/i],
    ['respiratorySystem', /\b(respiratory system|respiratory tract|airway|pulmonary ventilation)\b/i],
    ['digestiveSystem', /\b(digestive system|gastrointestinal tract|alimentary canal|digestive tract|gut anatomy)\b/i],
    ['urinarySystem', /\b(urinary system|urinary tract|renal system|kidney anatomy|urinary bladder)\b/i],
    ['reproductiveSystem', /\b(reproductive system|reproductive anatomy|genital system|male reproductive|female reproductive)\b/i],
  ];
  for (const [key, pattern] of systems) {
    if (pattern.test(text)) return modelContext(key);
  }

  return {
    type: 'whiteboard',
    topic: extractTopic(text, courseName),
    markdown: transcriptToWhiteboardMarkdown(text),
  };
}
