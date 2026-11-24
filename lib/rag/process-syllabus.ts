import { chunkFacts, type ParsedDocument, type AtomicChunk } from './ingestor';
import { compileCanonicalConcept, type CanonicalConcept, type CitedAtomicFact } from './deduplicator';
import { clinicalTopicLabels, legacyClinicalTopicLabels } from './clinical-topic';
import { isTeachingMetadata } from '@/lib/live-class/teaching-content';

type ProcessedConcept = CanonicalConcept & {
  module: string;
  topic: string;
  chunk: AtomicChunk;
  chunks: AtomicChunk[];
};

function legacyProcess(document: ParsedDocument): ProcessedConcept[] {
  const labels = legacyClinicalTopicLabels(document.sections.map(section => section.heading));
  return document.sections.flatMap((section, sectionIndex) => {
    const label = labels[sectionIndex];
    const topic = label;
    const chunks = chunkFacts(section.facts, 1150);
    return chunks.map((chunk, index) => {
      const lines = chunk.text.split('\n').filter(Boolean).map(text => ({
        text, sourceFile: chunk.sourceFile, pageNumber: chunk.pageNumber, documentId: chunk.documentId,
      }));
      const title = label + (chunks.length > 1 ? ' · ' + (index + 1) : '');
      return { ...compileCanonicalConcept(title, lines), module: document.source, topic, chunk, chunks: [chunk] };
    });
  });
}

/** Retrieval chunks remain small and citation-addressable; a teaching concept may
 * contain several contiguous chunks from one coherent curriculum heading. */
export function processSyllabus(documents: ParsedDocument[], legacy=false): ProcessedConcept[] {
  return documents.flatMap(document => {
    if (legacy) return legacyProcess(document);
    const labels = clinicalTopicLabels(document.sections.map(section => section.heading));
    const counts = new Map<string, number>();
    for (const section of document.sections) for (const fact of section.facts) {
      const normalized = fact.text.replace(/\s+/g, ' ').trim().toLowerCase();
      if (normalized.length >= 8 && normalized.length <= 140) counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
    const groups = new Map<string, { title: string; topic: string; facts: CitedAtomicFact[] }>();
    document.sections.forEach((section, sectionIndex) => {
      const label = labels[sectionIndex] || 'General concepts';
      const metadataSection = /^(?:source attribution|document information)$/i.test(section.heading.trim());
      if (metadataSection || isTeachingMetadata(section.heading)) return;
      const topic = label.split(' · ')[0] || 'General concepts';
      // Keep clinical sub-sections distinct, but merge slide fragments that share
      // the same named concept or clinical sub-section.
      const key = label.toLowerCase();
      const group = groups.get(key) || { title: label, topic, facts: [] };
      for (const fact of section.facts) {
        const text = fact.text.trim();
        const normalized = text.replace(/\s+/g, ' ').toLowerCase();
        const repeatedHeader = (counts.get(normalized) || 0) >= 4 &&
          /\b(?:university|department|faculty|college|school of|lecture notes|revision|mbbs|copyright)\b/i.test(text);
        if (!text || isTeachingMetadata(text) || repeatedHeader) continue;
        group.facts.push(fact);
      }
      if (group.facts.length) groups.set(key, group);
    });
    return [...groups.values()].flatMap(group => {
      const chunks = chunkFacts(group.facts, 1150);
      if (!chunks.length) return [];
      const concept = compileCanonicalConcept(group.title, group.facts);
      return [{ ...concept, module: document.source, topic: group.topic, chunk: chunks[0], chunks }];
    });
  });
}
