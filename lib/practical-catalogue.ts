export const FREE_COURSE_DIVISION = 'Anatomical Pathology';

export const ANATOMICAL_PATHOLOGY_SYSTEMS = [
  'Breast',
  'Cardiovascular',
  'Central Nervous System',
  'Female Genital Tract',
  'Gastrointestinal System',
  'Genitourinary System',
  'Hepatobiliary System',
  'Lymphoreticular / Haematopoietic',
  'Other / Congenital',
  'Other / Surface',
  'Respiratory System',
  'Thyroid',
] as const;

export type AnatomicalPathologySystem = typeof ANATOMICAL_PATHOLOGY_SYSTEMS[number];

export function normalizePracticalBranch(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

export function getAnatomicalPathologySystem(value?: string) {
  const normalized = normalizePracticalBranch(value);
  return ANATOMICAL_PATHOLOGY_SYSTEMS.find((system) => normalizePracticalBranch(system) === normalized) ?? null;
}

export function isFreeAnatomicalPathologySystem(value?: string, selectedSystem?: string | null) {
  return Boolean(selectedSystem && normalizePracticalBranch(value) === normalizePracticalBranch(selectedSystem));
}

export function isAnatomicalPathologyAggregate(subjectId: string, division: string) {
  const slug = division.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return subjectId === 'pathology' && slug === 'anatomical-pathology';
}
