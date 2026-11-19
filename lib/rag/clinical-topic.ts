/** Deterministic, source-heading-only navigation labels; never generate a diagnosis
 * or rewrite the original evidence. Plain clinical section names inherit the
 * nearest explicit heading in the same document; named headings stand alone. */
const categories: Array<[string, RegExp]> = [
  ['Foundations', /^(?:definition|definitions|overview|introduction|anatomy|normal anatomy|background|epidemiology|incidence|prevalence)$/i],
  ['Classification', /^(?:classification|classifications|types|subtypes|staging|grading)$/i],
  ['Etiology', /^(?:etiology|aetiology|causes|risk factors|etiology and risk factors|aetiology and risk factors)$/i],
  ['Pathogenesis', /^(?:pathogenesis|pathophysiology|mechanism|mechanisms|mechanism of disease|mechanism of action)$/i],
  ['Morphology', /^(?:morphology|histology|gross appearance|gross morphology|gross pathology|microscopy|microscopic appearance|histopathology)$/i],
  ['Clinical features', /^(?:clinical features|clinical manifestations|clinical presentation|presentation|symptoms|signs|signs and symptoms)$/i],
  ['Investigations', /^(?:investigations|investigation|diagnosis|diagnostic criteria|laboratory findings|differential diagnosis|imaging)$/i],
  ['Management', /^(?:management|treatment|therapy|therapeutics|prevention|drug treatment|pharmacological management)$/i],
  ['Complications and prognosis', /^(?:complications|prognosis|outcomes|follow.up|sequelae)$/i],
];
export function clinicalTopicLabels(headings: readonly string[]): string[] {
  let anchor = '';
  return headings.map((original) => {
    const heading = original.trim() || 'General concepts';
    const normalized = heading.replace(/^(?:\d{1,2}\.){1,3}\s+/, '').replace(/[:：]\s*$/, '').trim();
    const category = categories.find(([, pattern]) => pattern.test(normalized))?.[0];
    if (category) return anchor ? anchor + ' · ' + category : category;
    if (/^(?:slide\s+\d+|general concepts|general|untitled)$/i.test(normalized)) return anchor ? anchor + ' · ' + heading : heading;
    anchor = heading;
    return heading;
  });
}
