import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export type StoredMedicalModel = {
  key: string;
  url: string;
  title: string;
  category: string;
  topics: string[];
  source: string;
  referenceAnatomy: boolean;
};

export type MedicalModelInventory = {
  models: StoredMedicalModel[];
  count: number;
  scannedFiles: number;
  truncated: boolean;
  fetchedAt: string;
  source: 'supabase-medical-models';
};

const BUCKET = 'medical-models';
const MAX_MODELS = 1200;
const MAX_FOLDERS = 300;
const PAGE_SIZE = 100;
const CACHE_MS = 180_000;
let cache: { timestamp: number; value: MedicalModelInventory } | undefined;
let pending: Promise<MedicalModelInventory> | undefined;

const MEDICAL_TERMS: Record<string, string[]> = {
  heart: ['cardiac', 'myocardial', 'cardiology', 'ventricle', 'atrium', 'pericarditis'],
  lung: ['pulmonary', 'respiratory', 'bronchial', 'pneumonia', 'bronchiectasis'],
  kidney: ['renal', 'nephrology', 'glomerular', 'hydronephrosis'],
  liver: ['hepatic', 'hepatocyte', 'cirrhosis', 'steatosis'],
  brain: ['cerebral', 'neurology', 'cortex', 'intracranial'],
  blood: ['haematology', 'hematology', 'erythrocyte', 'leukocyte', 'anaemia'],
  vessel: ['vascular', 'artery', 'vein', 'thrombosis'],
  cell: ['cytology', 'histology', 'pathology'],
  receptor: ['pharmacodynamics', 'agonist', 'antagonist', 'drug'],
  synapse: ['pharmacology', 'acetylcholine', 'neurotransmission'],
  tumor: ['tumour', 'carcinoma', 'cancer', 'oncology'],
  microbe: ['microbiology', 'infection', 'bacteria'],
  immun: ['immunology', 'antigen', 'antibody', 'lymphocyte'],
  uter: ['uterus', 'uterine', 'endometrium', 'gynaecology'],
  pancreas: ['pancreatic', 'insulin', 'diabetes'],
};

function cleanPath(value: string) {
  return value && value.length <= 250
    && !value.includes('..') && !value.includes('\\')
    && /^[A-Za-z0-9._/() -]+$/.test(value);
}

function describe(path: string) {
  const filename = path.split('/').at(-1) || path;
  const words = filename.replace(/\.(glb)$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_().-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const folder = path.split('/').slice(0, -1).join(' ');
  const search = (words + ' ' + folder).toLowerCase();
  const expanded = new Set(
    (words + ' ' + folder).toLowerCase()
      .split(/[^a-z0-9]+/).filter(term => term.length > 2 && !/^\d+$/.test(term)),
  );
  for (const [term, synonyms] of Object.entries(MEDICAL_TERMS)) {
    if (search.includes(term)) synonyms.forEach(word => expanded.add(word));
  }
  const referenceAnatomy = /(?:^|\/)hra[-_/]|(?:^|\/)(?:organs|anatomy)\//i.test(path);
  const category = referenceAnatomy ? 'reference anatomy'
    : /patholog|cytolog|histolog|morpholog|carcinoma|necrosis/i.test(path) ? 'pathology'
    : /pharmacol|receptor|drug/i.test(path) ? 'pharmacology'
    : /microbiol|bacter|virus|fung/i.test(path) ? 'microbiology'
    : /haematol|hematol|blood/i.test(path) ? 'haematology'
    : /immunol|antibody|antigen/i.test(path) ? 'immunology'
    : 'medical 3D';
  return { title: words || 'Medical teaching model', topics: [...expanded].slice(0, 22), category, referenceAnatomy };
}

async function loadInventory(): Promise<MedicalModelInventory> {
  const admin = createAdminClient();
  if (!admin) throw new Error('Medical model storage client is not configured');
  const { data: bucket, error: bucketError } = await admin.storage.getBucket(BUCKET);
  if (bucketError || !bucket?.public) {
    throw new Error('Medical models bucket unavailable or not public');
  }
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!origin) throw new Error('Missing Supabase storage origin');

  const paths: string[] = [''];
  const seenFolders = new Set<string>();
  const models: StoredMedicalModel[] = [];
  let scannedFiles = 0;
  let truncated = false;
  while (paths.length) {
    if (seenFolders.size >= MAX_FOLDERS || models.length >= MAX_MODELS) {
      truncated = true;
      break;
    }
    const folder = paths.shift()!;
    if (seenFolders.has(folder)) continue;
    seenFolders.add(folder);
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage.from(BUCKET).list(folder, {
        limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error('Cannot list live medical models in storage');
      const entries = data || [];
      for (const entry of entries) {
        const path = folder ? folder + '/' + entry.name : entry.name;
        if (!cleanPath(path)) continue;
        // Storage folders have no id / metadata. Never invent URLs for them.
        if (!entry.id) {
          if (paths.length + seenFolders.size < MAX_FOLDERS) paths.push(path);
          else truncated = true;
          continue;
        }
        scannedFiles += 1;
        if (!/\.glb$/i.test(entry.name)) continue;
        const size = Number(entry.metadata?.size || 0);
        if (!Number.isFinite(size) || size < 100 || size > 85_000_000) continue;
        if (models.length >= MAX_MODELS) { truncated = true; break; }
        const description = describe(path);
        models.push({
          key: 'bucket_' + createHash('sha256').update(path).digest('hex').slice(0, 14),
          url: origin + '/storage/v1/object/public/' + BUCKET + '/'
            + path.split('/').map(encodeURIComponent).join('/'),
          title: description.title,
          category: description.category,
          topics: description.topics,
          referenceAnatomy: description.referenceAnatomy,
          source: 'Verified Supabase storage object; medical accuracy and licence depend on original asset',
        });
      }
      if (models.length >= MAX_MODELS) break;
      if (entries.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  models.sort((a, b) => a.title.localeCompare(b.title));
  return {
    models, count: models.length, scannedFiles, truncated,
    fetchedAt: new Date().toISOString(), source: 'supabase-medical-models',
  };
}

/** Every route shares the same short-lived, source-preserving bucket inventory.
 * This does not add, alter, or delete any Supabase objects.
 */
export async function getLiveClassStorageModels(): Promise<MedicalModelInventory> {
  if (cache && Date.now() - cache.timestamp < CACHE_MS) return cache.value;
  if (!pending) {
    pending = loadInventory().then(value => {
      cache = { timestamp: Date.now(), value };
      return value;
    }).finally(() => { pending = undefined; });
  }
  return pending;
}
