import { createHash } from 'node:crypto';

export type CitedAtomicFact = { text: string; sourceFile: string; pageNumber: number | null; documentId: string };
export type CanonicalConcept = {
  title: string;
  notes: string;
  facts: CitedAtomicFact[];
  citations: Array<{ file_name: string; page_number: number | null; document_id: string }>;
};

/** Exact-only deduplication: numerical differences, wording differences, caveats and exceptions survive. */
export function uniqueFacts(facts: CitedAtomicFact[]): CitedAtomicFact[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const normal = fact.text.replace(/\s+/g, ' ').trim();
    const key = createHash('sha256').update(normal).digest('hex');
    if (!normal || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function compileCanonicalConcept(title: string, facts: CitedAtomicFact[]): CanonicalConcept {
  const distinct = uniqueFacts(facts);
  const citations = facts.map((fact) => ({ file_name: fact.sourceFile, page_number: fact.pageNumber, document_id: fact.documentId }));
  const uniqueCitations = citations.filter((citation, index) =>
    citations.findIndex((entry) => entry.file_name === citation.file_name && entry.page_number === citation.page_number && entry.document_id === citation.document_id) === index
  );
  return { title, facts: distinct, notes: distinct.map((fact) => fact.text).join('\n\n'), citations: uniqueCitations };
}
