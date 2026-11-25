const ABBREVIATIONS: Record<string, string> = {
  eGFR: 'estimated glomerular filtration rate', HbA1c: 'haemoglobin A one C', NSAIDs: 'nonsteroidal anti-inflammatory drugs',
  NSAID: 'nonsteroidal anti-inflammatory drug', CYP3A4: 'cytochrome P four fifty, three A four', ACE: 'angiotensin converting enzyme',
  'H&E': 'haematoxylin and eosin', TB: 'tuberculosis', MI: 'myocardial infarction', CHF: 'congestive heart failure',
  DIC: 'disseminated intravascular coagulation', ARDS: 'acute respiratory distress syndrome', CNS: 'central nervous system',
  RBCs: 'red blood cells', WBCs: 'white blood cells', RBC: 'red blood cell', WBC: 'white blood cell', ECG: 'E C G',
  DNA: 'D N A', RNA: 'R N A', IgG: 'immunoglobulin G', IgM: 'immunoglobulin M', IgA: 'immunoglobulin A', IgE: 'immunoglobulin E',
  TNF: 'tumour necrosis factor', 'IL-1': 'interleukin one', 'IL-6': 'interleukin six',
};
const PHONEMES: Record<string, string> = {
  pharmacokinetics: 'pharmacokinetics', adenocarcinoma: 'adenocarcinoma',
};

export function medicalSpeech(input: string): string {
  let text = String(input || '').replace(/<\/?(?:speed|emotion|volume|break)\b[^>]*>/gi, '');
  text = text.replace(/```[\s\S]*?```/g, ' ').replace(/[*_`]/g, '');
  text = text.replace(/^\s*(?:#{1,6}|[•●▪◦]|[-*]\s+|\d{1,3}[.)]\s+)/gm, '');
  text = text.replace(/[•●▪◦·]+/g, ', ').replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim();
  for (const [term, spoken] of Object.entries(ABBREVIATIONS)) text = text.replace(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), spoken);
  for (const [unit, spoken] of [['mL/min', 'millilitres per minute'], ['mmHg', 'millimetres of mercury'], ['mcg', 'micrograms'], ['µg', 'micrograms'], ['μg', 'micrograms'], ['mg', 'milligrams'], ['mL', 'millilitres']] as const) {
    text = text.replace(new RegExp(`(?<=\\d)\\s*${unit.replace('/', '\\/')}(?=\\b)`, 'g'), ` ${spoken}`);
  }
  text = text.replace(/≤/g, ' less than or equal to ').replace(/≥/g, ' greater than or equal to ')
    .replace(/>(?=\s*\d)/g, ' greater than ').replace(/<(?=\s*\d)/g, ' less than ')
    .replace(/α/g, 'alpha').replace(/β/g, 'beta');
  for (const [term, spoken] of Object.entries(PHONEMES)) text = text.replace(new RegExp(`\\b${term}\\b`, 'gi'), spoken);
  return text.replace(/\s+/g, ' ').trim();
}

function sentenceParts(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(part => part.trim()).filter(Boolean) ?? [];
}

/** Normalize first, then split only at whitespace/sentence boundaries; never split a medical token. */
export function chunkMedicalSpeech(input: string, target = 420, hardCap = 1500): string[] {
  const normalized = medicalSpeech(input);
  if (!normalized) return [];
  const cap = Math.min(Math.max(200, hardCap), 1500);
  const preferred = Math.min(Math.max(200, target), 500);
  const chunks: string[] = [];
  let current = '';
  const add = (part: string) => {
    const words = part.split(/\s+/).filter(Boolean);
    for (const word of words) {
      if (!current) { current = word; continue; }
      if ((current + ' ' + word).length <= preferred) current += ' ' + word;
      else { chunks.push(current); current = word; }
    }
  };
  for (const sentence of sentenceParts(normalized)) {
    if (sentence.length <= preferred && (!current || (current + ' ' + sentence).length <= preferred)) current = current ? current + ' ' + sentence : sentence;
    else add(sentence);
  }
  if (current) chunks.push(current);
  const safe: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= cap) safe.push(chunk);
    else {
      let rest = chunk;
      while (rest.length > cap) { const cut = rest.lastIndexOf(' ', cap); const at = cut > 0 ? cut : cap; safe.push(rest.slice(0, at)); rest = rest.slice(at).trimStart(); }
      if (rest) safe.push(rest);
    }
  }
  return safe;
}
