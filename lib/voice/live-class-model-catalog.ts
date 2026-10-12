import { LIVE_CLASS_MODEL_ASSETS, LIVE_CLASS_MOLECULE_ASSETS } from '@/lib/voice/live-class-visuals';

const LIVE_CLASS_MODEL_CATALOG_ENTRIES = [
  { key: 'brain', modelUrl: LIVE_CLASS_MODEL_ASSETS.brain, title: 'Brain', category: 'anatomy', topics: ['gross neuroanatomy', 'cerebrum', 'cerebellum', 'brainstem'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'heart', modelUrl: LIVE_CLASS_MODEL_ASSETS.heart, title: 'Heart', category: 'anatomy', topics: ['cardiac anatomy', 'atria', 'ventricles', 'valves', 'myocardium'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'lungs', modelUrl: LIVE_CLASS_MODEL_ASSETS.lungs, title: 'Lungs', category: 'anatomy', topics: ['lungs', 'pulmonary anatomy', 'bronchi', 'alveoli'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'liver', modelUrl: LIVE_CLASS_MODEL_ASSETS.liver, title: 'Liver', category: 'anatomy', topics: ['liver', 'hepatic anatomy', 'hepatobiliary system'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'kidneys', modelUrl: LIVE_CLASS_MODEL_ASSETS.kidneys, title: 'Kidney, Male, Right', category: 'anatomy', topics: ['right kidney', 'renal anatomy', 'urinary system'], source: 'HRA 3D Reference Object Library, “Kidney, Male, Right,” by Kristen Browne and Heidi Schlehlein; v1.2; CC BY 4.0; DOI 10.48539/HBM364.QTSC.334.', sourceUrl: 'https://3d.nih.gov/entries/21002/1' },
  { key: 'integumentarySystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.integumentarySystem, title: 'Integumentary system', category: 'anatomy', topics: ['skin', 'epidermis', 'dermis', 'hair follicles'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'muscularSystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.muscularSystem, title: 'Muscular system', category: 'anatomy', topics: ['muscles', 'muscular anatomy', 'muscle groups'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'nervousSystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.nervousSystem, title: 'Nervous system', category: 'anatomy', topics: ['nervous system', 'spinal cord', 'peripheral nerves', 'autonomic nervous system'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'endocrineSystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.endocrineSystem, title: 'Endocrine system', category: 'anatomy', topics: ['endocrine glands', 'pituitary', 'thyroid', 'adrenal glands', 'hormone pathways'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'cardiovascularSystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.cardiovascularSystem, title: 'Cardiovascular system', category: 'anatomy', topics: ['circulation', 'arteries', 'veins', 'blood vessels'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'lymphaticSystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.lymphaticSystem, title: 'Lymphatic system', category: 'anatomy', topics: ['lymphatic system', 'lymph nodes', 'lymph vessels', 'immune anatomy'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'respiratorySystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.respiratorySystem, title: 'Respiratory system', category: 'anatomy', topics: ['respiratory tract', 'airways', 'pulmonary ventilation'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'digestiveSystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.digestiveSystem, title: 'Digestive system', category: 'anatomy', topics: ['gastrointestinal tract', 'alimentary canal', 'gut anatomy'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'urinarySystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.urinarySystem, title: 'Urinary system', category: 'anatomy', topics: ['urinary tract', 'kidney anatomy', 'urinary bladder'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'reproductiveSystem', modelUrl: LIVE_CLASS_MODEL_ASSETS.reproductiveSystem, title: 'Reproductive system', category: 'anatomy', topics: ['male reproductive anatomy', 'female reproductive anatomy', 'genital system'], source: 'Z-Anatomy / BodyParts3D; see manifest for attribution and dual-license terms.' },
  { key: 'bloodCellMorphology', modelUrl: LIVE_CLASS_MODEL_ASSETS.bloodCellMorphology, title: 'Blood-cell morphology', category: 'cytology', topics: ['normal erythrocyte', 'sickle-shaped erythrocyte', 'red blood cell', 'haemoglobin', 'oxygen transport'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic micrograph.' },
  { key: 'leukocyteMorphology', modelUrl: LIVE_CLASS_MODEL_ASSETS.leukocyteMorphology, title: 'Leukocyte morphology', category: 'cytology', topics: ['neutrophil', 'lymphocyte', 'eosinophil', 'granules'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic micrograph.' },
  { key: 'leukemiaBlastMorphology', modelUrl: LIVE_CLASS_MODEL_ASSETS.leukemiaBlastMorphology, title: 'Acute leukaemia blast morphology', category: 'pathology', topics: ['acute leukaemia', 'myeloblast', 'blast morphology', 'bone marrow'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not diagnostic.' },
  { key: 'epithelialDysplasia', modelUrl: LIVE_CLASS_MODEL_ASSETS.epithelialDysplasia, title: 'Epithelial tissue and dysplasia', category: 'histology', topics: ['normal epithelium', 'dysplastic epithelium', 'cellular atypia', 'basement membrane'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic micrograph.' },
  { key: 'atherosclerosis', modelUrl: LIVE_CLASS_MODEL_ASSETS.atherosclerosis, title: 'Atherosclerosis and arterial plaque', category: 'pathology', topics: ['arterial wall', 'plaque', 'lumen narrowing', 'atherosclerosis'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic model.' },
  { key: 'tumorMicroenvironment', modelUrl: LIVE_CLASS_MODEL_ASSETS.tumorMicroenvironment, title: 'Tumour microenvironment', category: 'pathology', topics: ['tumour cells', 'stromal cells', 'microvessels', 'angiogenesis'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic model.' },
] as const;

const Z_ANATOMY_ATTRIBUTION = {
  source: 'BodyParts3D, © The Database Center for Life Science; Z-Anatomy / Gauthier Kervyn. Derived model export.',
  sourceUrl: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
  sourceLabel: 'BodyParts3D / Z-Anatomy',
  license: 'CC BY-SA 2.1 Japan',
  licenseLabel: 'CC BY-SA 2.1 Japan',
  recordLicense: 'CC BY 4.0',
  licenseUrl: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
  recordUrl: 'https://zenodo.org/records/4953712',
} as const;

export const LIVE_CLASS_MODEL_CATALOG = LIVE_CLASS_MODEL_CATALOG_ENTRIES.map((asset) => {
  if (asset.source.startsWith('Z-Anatomy / BodyParts3D')) {
    return { ...asset, ...Z_ANATOMY_ATTRIBUTION };
  }
  if (asset.key === 'kidneys') {
    return { ...asset, sourceLabel: 'HRA 3D Reference Object Library', license: 'CC BY 4.0', licenseLabel: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' };
  }
  if (['bloodCellMorphology', 'leukocyteMorphology', 'leukemiaBlastMorphology', 'epithelialDysplasia', 'atherosclerosis', 'tumorMicroenvironment'].includes(asset.key)) {
    return { ...asset, sourceLabel: 'Original LenxiQ educational schematic', license: 'CC BY 4.0', licenseLabel: 'CC BY 4.0' };
  }
  return asset;
});

export const LIVE_CLASS_MOLECULE_CATALOG = [
  {
    ...LIVE_CLASS_MOLECULE_ASSETS.beta2Adrenergic,
    ligandResidue: 'CAU',
    category: 'pharmacology',
    topics: ['β2-adrenergic receptor', 'carazolol', 'β-blocker target', 'GPCR structure'],
    source: 'RCSB Protein Data Bank entry 2RH1; CC0 1.0; attribution encouraged.',
    sourceUrl: 'https://www.rcsb.org/structure/2RH1',
  },
  {
    ...LIVE_CLASS_MOLECULE_ASSETS.acetylcholinesterase,
    ligandResidue: 'E20',
    category: 'pharmacology',
    topics: ['acetylcholinesterase', 'donepezil', 'cholinesterase inhibitor'],
    source: 'RCSB Protein Data Bank entry 4EY7; CC0 1.0; attribution encouraged.',
    sourceUrl: 'https://www.rcsb.org/structure/4EY7',
  },
  {
    ...LIVE_CLASS_MOLECULE_ASSETS.dihydrofolateReductase,
    ligandResidue: 'MTX',
    category: 'pharmacology',
    topics: ['dihydrofolate reductase', 'methotrexate', 'folate antagonist', 'antifolate'],
    source: 'RCSB Protein Data Bank entry 1U72; CC0 1.0; attribution encouraged.',
    sourceUrl: 'https://www.rcsb.org/structure/1U72',
  },
] as const;

export function getLiveClassModelCatalogEntry(modelUrl: string) {
  const normalizedUrl = modelUrl.split(/[?#]/, 1)[0];
  return LIVE_CLASS_MODEL_CATALOG.find((asset) => asset.modelUrl === normalizedUrl);
}

export function getLiveClassMoleculeCatalogEntry(modelUrl: string) {
  const normalizedUrl = modelUrl.split(/[?#]/, 1)[0];
  return LIVE_CLASS_MOLECULE_CATALOG.find((asset) => asset.modelUrl === normalizedUrl);
}
