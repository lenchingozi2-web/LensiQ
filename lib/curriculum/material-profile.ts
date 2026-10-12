export type MaterialProfile = {
  sourceFileName: string;
  detectedBranches: string[];
  primaryBranch: string | null;
  extractedCharacterCount: number;
};

const BRANCH_PATTERNS: Array<[string, RegExp]> = [
  ['Pharmacology', /\b(pharmacology|pharmacokinetic|pharmacodynamic|adme|agonist|antagonist|receptor|dose[- ]response|drug|medication|therapeutic|bioavailability|clearance|half[- ]life|donepezil|methotrexate|warfarin|insulin|antibiotic)\b/gi],
  ['Anatomical Pathology', /\b(anatomical pathology|histology|dysplasia|neoplasm|tumou?r|carcinoma|metastasis|biopsy|cytology|leukaemia|leukemia|necrosis|apoptosis|inflammation|atheroscleros(?:is|tic))\b/gi],
  ['Chemical Pathology', /\b(chemical pathology|clinical chemistry|bilirubin|transaminase|creatinine|urea|electrolyte|acid[- ]base|anion gap|hba1c|cholesterol|troponin|liver function test|renal function test)\b/gi],
  ['Haematology / Immunology', /\b(haematology|hematology|immunology|antibody|antigen|autoimmune|haemoglobin|hemoglobin|erythrocyte|leukocyte|neutrophil|lymphocyte|coagulation|haemostasis|sickle cell)\b/gi],
  ['Microbiology', /\b(microbiology|bacteriology|virology|fungal|parasite|pathogen|bacteria|virus|antimicrobial resistance|culture|stain)\b/gi],
];

export function detectMaterialBranches(text: string, sourceFileName: string, extractedCharacterCount = text.length): MaterialProfile {
  const scores = BRANCH_PATTERNS.map(([branch, pattern]) => ({ branch, score: (text.match(pattern) ?? []).length }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
  return {
    sourceFileName,
    detectedBranches: scores.map((item) => item.branch),
    primaryBranch: scores[0]?.branch ?? null,
    extractedCharacterCount,
  };
}
