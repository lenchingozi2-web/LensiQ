import { LIVE_CLASS_MODEL_ASSETS, LIVE_CLASS_MOLECULE_ASSETS } from '@/lib/voice/live-class-visuals';

const LIVE_CLASS_MODEL_CATALOG_ENTRIES = [
  { key: 'kidneys', modelUrl: LIVE_CLASS_MODEL_ASSETS.kidneys, title: 'Kidney, Male, Right', category: 'anatomy', topics: ['right kidney', 'renal anatomy', 'urinary system'], source: 'HRA 3D Reference Object Library, “Kidney, Male, Right,” by Kristen Browne and Heidi Schlehlein; v1.2; CC BY 4.0; DOI 10.48539/HBM364.QTSC.334.', sourceUrl: 'https://3d.nih.gov/entries/21002/1' },
  { key: 'bloodCellMorphology', modelUrl: LIVE_CLASS_MODEL_ASSETS.bloodCellMorphology, title: 'Blood-cell morphology', category: 'cytology', topics: ['normal erythrocyte', 'sickle-shaped erythrocyte', 'red blood cell', 'haemoglobin', 'oxygen transport'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic micrograph.' },
  { key: 'leukocyteMorphology', modelUrl: LIVE_CLASS_MODEL_ASSETS.leukocyteMorphology, title: 'Leukocyte morphology', category: 'cytology', topics: ['neutrophil', 'lymphocyte', 'eosinophil', 'granules'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic micrograph.' },
  { key: 'leukemiaBlastMorphology', modelUrl: LIVE_CLASS_MODEL_ASSETS.leukemiaBlastMorphology, title: 'Acute leukaemia blast morphology', category: 'pathology', topics: ['acute leukaemia', 'myeloblast', 'blast morphology', 'bone marrow'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not diagnostic.' },
  { key: 'epithelialDysplasia', modelUrl: LIVE_CLASS_MODEL_ASSETS.epithelialDysplasia, title: 'Epithelial tissue and dysplasia', category: 'histology', topics: ['normal epithelium', 'dysplastic epithelium', 'cellular atypia', 'basement membrane'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic micrograph.' },
  { key: 'atherosclerosis', modelUrl: LIVE_CLASS_MODEL_ASSETS.atherosclerosis, title: 'Atherosclerosis and arterial plaque', category: 'pathology', topics: ['arterial wall', 'plaque', 'lumen narrowing', 'atherosclerosis'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic model.' },
  { key: 'tumorMicroenvironment', modelUrl: LIVE_CLASS_MODEL_ASSETS.tumorMicroenvironment, title: 'Tumour microenvironment', category: 'pathology', topics: ['tumour cells', 'stromal cells', 'microvessels', 'angiogenesis'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic model.' },
  { key: 'granulomatousInflammation', modelUrl: LIVE_CLASS_MODEL_ASSETS.granulomatousInflammation, title: 'Granulomatous inflammation', category: 'pathology', topics: ['granuloma', 'epithelioid macrophage', 'giant cell', 'caseous necrosis'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not diagnostic.' },
  { key: 'fattyLiver', modelUrl: LIVE_CLASS_MODEL_ASSETS.fattyLiver, title: 'Fatty-liver steatosis', category: 'histology', topics: ['fatty liver', 'steatosis', 'hepatocyte', 'lipid vacuole'], source: 'Original LenxiQ educational schematic; CC BY 4.0; simplified, not a diagnostic micrograph.' },
  { key: 'gramCellEnvelope', modelUrl: LIVE_CLASS_MODEL_ASSETS.gramCellEnvelope, title: 'Gram-positive and Gram-negative cell envelopes', category: 'microbiology', topics: ["gram-positive and gram-negative cell envelopes","gram-positive","gram-negative","cell","envelopes"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'bacterialEndospore', modelUrl: LIVE_CLASS_MODEL_ASSETS.bacterialEndospore, title: 'Bacterial endospore and cortex', category: 'microbiology', topics: ["bacterial endospore and cortex","bacterial","endospore","cortex"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'envelopedVirus', modelUrl: LIVE_CLASS_MODEL_ASSETS.envelopedVirus, title: 'Enveloped virus and nucleocapsid', category: 'microbiology', topics: ["enveloped virus and nucleocapsid","enveloped","virus","nucleocapsid"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'septateFungalHypha', modelUrl: LIVE_CLASS_MODEL_ASSETS.septateFungalHypha, title: 'Septate fungal hypha and branching', category: 'microbiology', topics: ["septate fungal hypha and branching","septate","fungal","hypha","branching"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'bacterialBiofilm', modelUrl: LIVE_CLASS_MODEL_ASSETS.bacterialBiofilm, title: 'Bacterial biofilm and extracellular matrix', category: 'microbiology', topics: ["bacterial biofilm and extracellular matrix","bacterial","biofilm","extracellular","matrix"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'antibodyAntigen', modelUrl: LIVE_CLASS_MODEL_ASSETS.antibodyAntigen, title: 'Antibody structure and antigen binding', category: 'immunology', topics: ["antibody structure and antigen binding","antibody","structure","antigen","binding"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'opsonisation', modelUrl: LIVE_CLASS_MODEL_ASSETS.opsonisation, title: 'Opsonisation and phagocyte recognition', category: 'immunology', topics: ["opsonisation and phagocyte recognition","opsonisation","phagocyte","recognition"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'megaloblastic', modelUrl: LIVE_CLASS_MODEL_ASSETS.megaloblastic, title: 'Megaloblastic erythropoiesis', category: 'haematology', topics: ["megaloblastic erythropoiesis","megaloblastic","erythropoiesis"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'plateletFibrin', modelUrl: LIVE_CLASS_MODEL_ASSETS.plateletFibrin, title: 'Platelet–fibrin thrombus', category: 'haematology', topics: ["platelet–fibrin thrombus","platelet","fibrin","thrombus"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'acuteInflammation', modelUrl: LIVE_CLASS_MODEL_ASSETS.acuteInflammation, title: 'Acute inflammation and neutrophil diapedesis', category: 'pathology', topics: ["acute inflammation and neutrophil diapedesis","acute","inflammation","neutrophil","diapedesis"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'coagulativeNecrosis', modelUrl: LIVE_CLASS_MODEL_ASSETS.coagulativeNecrosis, title: 'Coagulative necrosis and tissue cell outlines', category: 'pathology', topics: ["coagulative necrosis and tissue cell outlines","coagulative","necrosis","tissue","cell","outlines"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'apoptosis', modelUrl: LIVE_CLASS_MODEL_ASSETS.apoptosis, title: 'Apoptosis, blebbing and nuclear fragments', category: 'pathology', topics: ["apoptosis, blebbing and nuclear fragments","apoptosis","blebbing","nuclear","fragments"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'thrombosisEmbolism', modelUrl: LIVE_CLASS_MODEL_ASSETS.thrombosisEmbolism, title: 'Thrombosis and embolism', category: 'pathology', topics: ["thrombosis and embolism","thrombosis","embolism"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'glomerularInflammation', modelUrl: LIVE_CLASS_MODEL_ASSETS.glomerularInflammation, title: 'Glomerular inflammation and capillary loops', category: 'pathology', topics: ["glomerular inflammation and capillary loops","glomerular","inflammation","capillary","loops"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'cirrhosis', modelUrl: LIVE_CLASS_MODEL_ASSETS.cirrhosis, title: 'Cirrhosis, regenerative nodules and fibrosis', category: 'pathology', topics: ["cirrhosis, regenerative nodules and fibrosis","cirrhosis","regenerative","nodules","fibrosis"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'invasiveCarcinoma', modelUrl: LIVE_CLASS_MODEL_ASSETS.invasiveCarcinoma, title: 'Epithelial carcinoma and basement-membrane invasion', category: 'pathology', topics: ["epithelial carcinoma and basement-membrane invasion","epithelial","carcinoma","basement-membrane","invasion"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'cholinergicSynapse', modelUrl: LIVE_CLASS_MODEL_ASSETS.cholinergicSynapse, title: 'Cholinergic synapse and acetylcholine transmission', category: 'pharmacology', topics: ["cholinergic synapse and acetylcholine transmission","cholinergic","synapse","acetylcholine","transmission"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'receptorOccupancy', modelUrl: LIVE_CLASS_MODEL_ASSETS.receptorOccupancy, title: 'Agonists and antagonists at receptors', category: 'pharmacology', topics: ["agonists and antagonists at receptors","agonists","antagonists","receptors"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
  { key: 'sodiumChannelBlockade', modelUrl: LIVE_CLASS_MODEL_ASSETS.sodiumChannelBlockade, title: 'Voltage-gated sodium-channel blockade', category: 'pharmacology', topics: ["voltage-gated sodium-channel blockade","voltage-gated","sodium-channel","blockade"], source: 'Original LenxiQ teaching schematic; simplified concept geometry, not a diagnostic specimen. Reuse is governed by LenxiQ terms.' },
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
  if (asset.modelUrl.includes('/concepts/v1/')) {
    return { ...asset, sourceLabel: 'Original LenxiQ teaching schematic' };
  }
  if (asset.source.startsWith('Original LenxiQ')) {
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
