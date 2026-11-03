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
  { key: 'hraLung', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraLung, title: 'Lung, reference anatomy', category: 'reference anatomy', topics: ["lung anatomy","pulmonary lobes","bronchiectasis","pneumonia"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraHeart', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraHeart, title: 'Heart, reference anatomy', category: 'reference anatomy', topics: ["heart anatomy","cardiac chambers","myocardial infarction","endocarditis"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraLiver', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraLiver, title: 'Liver, reference anatomy', category: 'reference anatomy', topics: ["liver anatomy","portal triad","liver morphology"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraKidney', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraKidney, title: 'Kidney, left, reference anatomy', category: 'reference anatomy', topics: ["kidney anatomy","hydronephrosis","renal cortex"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraBrain', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraBrain, title: 'Brain, reference anatomy', category: 'reference anatomy', topics: ["brain anatomy","cerebral cortex","stroke"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraPancreas', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraPancreas, title: 'Pancreas, reference anatomy', category: 'reference anatomy', topics: ["pancreas anatomy","pancreatitis","islets of Langerhans"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraSpleen', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraSpleen, title: 'Spleen, reference anatomy', category: 'reference anatomy', topics: ["spleen anatomy","splenomegaly","white pulp"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraLymphNode', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraLymphNode, title: 'Lymph node, reference anatomy', category: 'reference anatomy', topics: ["lymph node architecture","lymphoma","lymphadenitis"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraLargeIntestine', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraLargeIntestine, title: 'Large intestine, reference anatomy', category: 'reference anatomy', topics: ["colon anatomy","ulcerative colitis","colon cancer"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraSmallIntestine', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraSmallIntestine, title: 'Small intestine, reference anatomy', category: 'reference anatomy', topics: ["small intestine","Crohn disease","intestinal villi"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraSkin', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraSkin, title: 'Skin, reference anatomy', category: 'reference anatomy', topics: ["skin layers","epidermis","dermatitis"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraBladder', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraBladder, title: 'Urinary bladder, reference anatomy', category: 'reference anatomy', topics: ["urinary bladder","cystitis","urothelial carcinoma"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraUterus', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraUterus, title: 'Uterus, reference anatomy', category: 'reference anatomy', topics: ["uterus anatomy","endometrium","fibroids"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraProstate', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraProstate, title: 'Prostate, reference anatomy', category: 'reference anatomy', topics: ["prostate anatomy","BPH","prostate cancer"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraThymus', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraThymus, title: 'Thymus, reference anatomy', category: 'reference anatomy', topics: ["thymus","T cell maturation","thymoma"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraSpinalCord', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraSpinalCord, title: 'Spinal cord, reference anatomy', category: 'reference anatomy', topics: ["spinal cord","anterior horn","myelitis"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraTrachea', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraTrachea, title: 'Trachea, reference anatomy', category: 'reference anatomy', topics: ["trachea anatomy","airway","tracheal stenosis"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraMainBronchus', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraMainBronchus, title: 'Main bronchus, reference anatomy', category: 'reference anatomy', topics: ["bronchus","bronchial tree","aspiration"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraPlacenta', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraPlacenta, title: 'Placenta, reference anatomy', category: 'reference anatomy', topics: ["placenta anatomy","placental circulation","pre-eclampsia"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraRenalPelvis', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraRenalPelvis, title: 'Renal pelvis, reference anatomy', category: 'reference anatomy', topics: ["renal pelvis","hydronephrosis","ureteropelvic junction"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraEye', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraEye, title: 'Eye, reference anatomy', category: 'reference anatomy', topics: ["eye anatomy","retina","glaucoma"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraBloodVessels', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraBloodVessels, title: 'Blood vasculature, reference anatomy', category: 'reference anatomy', topics: ["arteries","veins","vasculitis"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraMammaryGland', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraMammaryGland, title: 'Mammary gland, reference anatomy', category: 'reference anatomy', topics: ["breast anatomy","breast cancer","ductal carcinoma"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraLarynx', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraLarynx, title: 'Larynx, reference anatomy', category: 'reference anatomy', topics: ["larynx","vocal folds","laryngeal cancer"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraUreter', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraUreter, title: 'Ureter, reference anatomy', category: 'reference anatomy', topics: ["ureter","ureteric stones","obstruction"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraKnee', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraKnee, title: 'Knee, reference anatomy', category: 'reference anatomy', topics: ["knee joint","osteoarthritis","ligaments"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraPelvis', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraPelvis, title: 'Pelvis, reference anatomy', category: 'reference anatomy', topics: ["pelvic bones","pelvic anatomy","bone marrow"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
  { key: 'hraFallopianTube', modelUrl: LIVE_CLASS_MODEL_ASSETS.hraFallopianTube, title: 'Fallopian tube, reference anatomy', category: 'reference anatomy', topics: ["fallopian tube","ectopic pregnancy","salpingitis"], source: 'Human Reference Atlas (HRA) 3D Reference Object Library, expert-reviewed organ model; CC BY 4.0. Healthy reference anatomy, not an image of disease.', sourceUrl: 'https://humanatlas.io/3d-reference-library' },
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
  if (asset.modelUrl.includes('/hra-v25/')) {
    return { ...asset, sourceLabel: 'Human Reference Atlas', license: 'CC BY 4.0', licenseLabel: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' };
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
