import { chunkFacts, type ParsedDocument } from './ingestor';
import { compileCanonicalConcept } from './deduplicator';
import { clinicalTopicLabels } from './clinical-topic';

/** Keep contiguous source passages together. Never merge identically titled
 * slides from different diseases or lose an exception to a teaching window. */
export function processSyllabus(documents: ParsedDocument[]) {
  return documents.flatMap(document => {
    const labels = clinicalTopicLabels(document.sections.map(section => section.heading));
    return document.sections.flatMap((section, sectionIndex) => {
    const topic = labels[sectionIndex];
    const chunks = chunkFacts(section.facts, 1150);
    return chunks.map((chunk, index) => {
      const lines = chunk.text.split('\n').filter(Boolean).map(text => ({
        text, sourceFile: chunk.sourceFile, pageNumber: chunk.pageNumber, documentId: chunk.documentId,
      }));
      const title = section.heading + (chunks.length > 1 ? ' · ' + (index + 1) : '');
      return { ...compileCanonicalConcept(title, lines), module: document.source, topic, chunk };
    });
    });
  });
}
