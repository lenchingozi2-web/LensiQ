import type { ParsedDocument } from './ingestor';
import { compileCanonicalConcept, type CitedAtomicFact } from './deduplicator';

export type CompiledNode = ReturnType<typeof compileCanonicalConcept> & { module: string; topic: string; order: number };

/** Coalesce repeated headings, without rewriting or deleting non-identical statements. */
export function processSyllabus(documents: ParsedDocument[]): CompiledNode[] {
  const groups = new Map<string, { module: string; topic: string; title: string; facts: CitedAtomicFact[] }>();
  for (const document of documents) {
    for (const section of document.sections) {
      const key = section.heading.normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
      const existing = groups.get(key);
      if (existing) existing.facts.push(...section.facts);
      else groups.set(key, { module: section.module, topic: section.topic, title: section.heading, facts: [...section.facts] });
    }
  }
  return [...groups.values()].map((group, order) => ({
    ...compileCanonicalConcept(group.title, group.facts),
    module: group.module,
    topic: group.topic,
    order,
  }));
}
