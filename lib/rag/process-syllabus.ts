import { chunkFacts, type ParsedDocument, type AtomicChunk } from './ingestor';
import { compileCanonicalConcept, type CanonicalConcept, type CitedAtomicFact } from './deduplicator';
import { clinicalTopicLabels, legacyClinicalTopicLabels } from './clinical-topic';
import { isTeachingMetadata, hasClinicalSubstance } from '@/lib/live-class/teaching-content';

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
    const consolidateByTopic = document.characters >= 100_000 || document.sections.length >= 100;
    const unitPattern = /^(?:lecture\s+)?unit\s+\d+\s*(?:[:.\-–—]\s*|\s+)(.+)$/i;
    let unit = '', started = false;
    document.sections.forEach((section, sectionIndex) => {
      const label = labels[sectionIndex] || 'General concepts';
      const metadataSection = /^(?:source attribution|document information)$/i.test(section.heading.trim());
      if (metadataSection || isTeachingMetadata(section.heading) || isTeachingMetadata(label)) return;
      const meaningful = section.facts.filter(fact=>!isTeachingMetadata(fact.text));
      const explicitUnit = section.heading.match(unitPattern);
      if (explicitUnit) unit = explicitUnit[1].trim();
      if (!started && !hasClinicalSubstance(section.heading + '\n' + meaningful.map(fact=>fact.text).join('\n'))) return;
      if (!meaningful.length) return;
      started = true;
      const topic = unit || label.split(' · ')[0] || 'General concepts';
      // Keep retrieval chunks granular, but on textbook-scale documents
      // consolidate related clinical subsections under their named topic so
      // slide fragments do not become hundreds of micro-concepts. Small
      // documents retain their precise section-level outline.
      const key = (unit || (consolidateByTopic ? topic : label)).toLowerCase();
      const title = unit || (consolidateByTopic ? topic : label);
      const group = groups.get(key) || { title, topic, facts: [] };
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
    const ordered = [...groups.values()];
    // In a large unlabelled bundle, keep all adjacent source groups in order
    // within bounded teaching units rather than promoting every slide heading.
    const bounded = consolidateByTopic && ordered.length > 100
      ? Array.from({length:Math.ceil(ordered.length/Math.ceil(ordered.length/100))},(_,i)=>{
          const size=Math.ceil(ordered.length/100), batch=ordered.slice(i*size,(i+1)*size), first=batch[0]!;
          return {title:batch.length===1?first.title:first.title+' · related sections',topic:first.topic,facts:batch.flatMap(group=>group.facts)};
        })
      : ordered;
    return bounded.flatMap(group => {
      const chunks = chunkFacts(group.facts, 1150);
      if (!chunks.length) return [];
      const facts: CitedAtomicFact[]=chunks.map(chunk=>({
          text:chunk.text,sourceFile:chunk.sourceFile,pageNumber:chunk.pageNumber,documentId:chunk.documentId,
      }));
      const concept=compileCanonicalConcept(group.title,facts);
      return[{...concept,module:document.source,topic:group.topic,chunk:chunks[0],chunks}];
    });
  });
}
