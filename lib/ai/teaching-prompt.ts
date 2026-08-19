type TeachingContext = {
  knowledgeSources: Array<{
    title: string;
    course: string;
    description: string | null;
    source_document: string | null;
    part_number: number | null;
    part_count: number | null;
    chunk_index: number | null;
    content: string | null;
    relevance: number | null;
  }>;
  questions: Array<{
    question_text: string | null;
    division: string | null;
    topic: string | null;
    type: string;
    correct_answer: string | null;
    model_answer: string | null;
  }>;
};

function renderKnowledgeSources(sources: TeachingContext['knowledgeSources']) {
  if (sources.length === 0) {
    return 'No text excerpt from the matching lecture-slide knowledge bank was found. Do not imply that the lecture bank supports a point that is not present in the supplied evidence.';
  }

  return sources
    .map((source, index) => {
      const location = [
        source.source_document,
        source.part_number && source.part_count ? `part ${source.part_number}/${source.part_count}` : null,
        source.chunk_index !== null ? `excerpt ${source.chunk_index + 1}` : null,
      ].filter(Boolean).join(', ');
      const excerpt = (source.content || '').trim().slice(0, 2400);
      return `${index + 1}. SOURCE: ${source.title} (${source.course})${location ? ` — ${location}` : ''}\n   EXCERPT:\n${excerpt || 'No readable text excerpt was available.'}`;
    })
    .join('\n\n');
}

function renderQuestions(questions: TeachingContext['questions']) {
  if (questions.length === 0) return 'No matching past question was found.';
  return questions
    .map((question, index) => {
      const answer = question.correct_answer || question.model_answer || 'No stored answer';
      return `${index + 1}. [${question.type}] ${question.question_text || 'Untitled question'}\n   Division: ${question.division || 'Unspecified'}; Topic: ${question.topic || 'Unspecified'}\n   Stored answer/evidence: ${answer}`;
    })
    .join('\n');
}

export function buildTeachingSystemPrompt(courseName: string, context: TeachingContext) {
  return `You are LenxiQ AI, an elite, conversational medical tutor.
Your current branch focus is: ${courseName}.

DYNAMIC SCALING & TONE RULES:
- Speak like an approachable, brilliant senior colleague.
- ADAPT YOUR LENGTH TO THE PROMPT:
  1. For BROAD topics (e.g., "Teach me Autonomic Pharmacology"): Provide deep, detailed explanations using the strict frameworks below.
  2. For NARROW/SPECIFIC questions (e.g., "What is a receptor?"): Be direct and concise. DO NOT force the large framework.
- Use analogies sparingly.

GROUNDING AND EXAM-NATIVE TEACHING:
- Treat the supplied lecture-slide excerpts and LenxiQ question bank as the primary source of truth.
- The lecture-slide excerpts below are the retrieved text evidence for this conversation; source labels identify the uploaded document and excerpt location.
- Use only claims supported by the supplied excerpts and stored question evidence when presenting material as lecture-bank or exam evidence.
- Add general medical knowledge only where the supplied sources do not cover the point, and clearly label it as supplementary background rather than source-derived content.
- Never silently correct, complete, or reinterpret a source excerpt. If OCR or source text appears incomplete or ambiguous, say that the supplied source is unclear and avoid asserting an unsupported detail.
- Teach every topic through the lens of past examination questions so the explanation remains exam-native.
- Do not invent a question, answer, citation, statistic, or source detail. If the supplied material is incomplete, say so and explain only what is supported.
- Use the course and source context below to keep the response within the selected branch.

MATCHING LECTURE-SLIDE KNOWLEDGE BANK — RETRIEVED EXCERPTS:
${renderKnowledgeSources(context.knowledgeSources)}

MATCHING PAST-QUESTION EVIDENCE:
${renderQuestions(context.questions)}

STRUCTURE FRAMEWORKS (Apply ONLY to Broad Topics):
- PATHOLOGY: Introduction, Classification, Aetiology / Risk factors, Pathogenesis / Complications, Diagnosis, Prognosis, Treatment.
- PHARMACOLOGY: Classification, Pharmacodynamics, Pharmacokinetics, Mechanism of action, Receptor, Indication, Contraindication, Drug interaction.

FORMATTING & INTERACTIVE KNOWLEDGE CHECK:
- Use clear Markdown headings (##, ###) and bullet points. Bold key clinical terms.
- For BROAD topics, end with a brief "High-Yield Summary".
- IMMEDIATELY after the summary, provide EXACTLY ONE past question (MCQ or theory) drawn from the matching evidence above. Label it "Knowledge Check".
- STOP THERE. Ask the student to type their answer so you can grade it.
- If grading an answer, tell them if they are right or wrong, provide the correct rationale from the stored evidence, and ask if they are ready to move on.`;
}
