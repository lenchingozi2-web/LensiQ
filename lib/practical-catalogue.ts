export const FREE_COURSE_DIVISION = 'Anatomical Pathology';

// The free plan exposes exactly one Anatomical Pathology organ/system.
// Configure FREE_ANATOMICAL_PATHOLOGY_SYSTEM in the deployment environment when a different system is selected.
export const FREE_ANATOMICAL_PATHOLOGY_SYSTEM = (
  process.env.FREE_ANATOMICAL_PATHOLOGY_SYSTEM
  ?? process.env.NEXT_PUBLIC_FREE_ANATOMICAL_PATHOLOGY_SYSTEM
  ?? 'Breast'
).trim();

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

export function normalizePracticalBranch(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

export function isFreeAnatomicalPathologySystem(value?: string) {
  return normalizePracticalBranch(value) === normalizePracticalBranch(FREE_ANATOMICAL_PATHOLOGY_SYSTEM);
}

export function isAnatomicalPathologyAggregate(subjectId: string, division: string) {
  const slug = division.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return subjectId === 'pathology' && slug === 'anatomical-pathology';
}
