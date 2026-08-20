export const FREE_PRACTICAL_BRANCH = 'Breast';

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

export function isAnatomicalPathologyAggregate(subjectId: string, division: string) {
  const slug = division.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return subjectId === 'pathology' && slug === 'anatomical-pathology';
}
