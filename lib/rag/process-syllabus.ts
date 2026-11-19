import { chunkFacts, type ParsedDocument } from './ingestor';
import { compileCanonicalConcept } from './deduplicator';

const clinicalSections = [
  ['Foundations', /definition|overview|introduction|anatomy/i],
  ['Classification', /classification|subtypes/i],
  ['Etiology', /etiolog|aetiolog|risk factors|causes/i],
  ['Pathogenesis', /pathogenesis|pathophysiology|mechanism/i],
  ['Morphology', /morpholog|histolog|gross appearance|microscop/i],
  ['Clinical features', /clinical features|presentation|symptoms|signs/i],
  ['Investigations', /investigation|diagnos|laboratory/i],
  ['Management', /management|treatment|therapy|prognosis/i],
] as const;

/** Keep contiguous source passages together. Never merge identically titled
 * slides from different diseases or lose an exception to a teaching window. */
export function processSyllabus(documents: ParsedDocument[]) {
  return documents.flatMap(document => document.sections.flatMap(section => {
    const topic = clinicalSections.find(([, pattern]) => pattern.test(section.heading))?.[0] || section.topic;
    const chunks = chunkFacts(section.facts, 1150);
    return chunks.map((chunk, index) => {
      const lines = chunk.text.split('\n').filter(Boolean).map(text => ({
        text, sourceFile: chunk.sourceFile, pageNumber: chunk.pageNumber, documentId: chunk.documentId,
      }));
      const title = section.heading + (chunks.length > 1 ? ' · ' + (index + 1) : '');
      return { ...compileCanonicalConcept(title, lines), module: document.source, topic, chunk };
    });
  }));
}
