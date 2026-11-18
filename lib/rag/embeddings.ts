export type EmbeddingProvider = 'external' | 'gemini' | 'lexical';
export type EmbeddingResult = { provider: EmbeddingProvider; values: number[] | null };
export type EmbeddingOptions = {
  env?: Record<string, string | undefined>;
  fetcher?: typeof fetch;
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';
  timeoutMs?: number;
};

const DIMENSIONS = 1536;
export function normalizeEmbedding(input: unknown): number[] {
  if (!Array.isArray(input) || input.length !== DIMENSIONS) throw new Error('Expected exactly 1536 embedding dimensions');
  const values = input.map(Number);
  let sum = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) throw new Error('Embedding contains a non-finite value');
    sum += value * value;
  }
  const length = Math.sqrt(sum);
  if (!Number.isFinite(length) || length <= 1e-15) throw new Error('Cannot normalize a zero embedding');
  return values.map((value) => value / length);
}

async function requestVector(url: string, init: RequestInit, fetcher: typeof fetch, timeoutMs: number): Promise<unknown> {
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (!response.ok) throw new Error('Embedding provider returned HTTP ' + response.status);
  return response.json();
}

/** Provider errors do not disable keyword retrieval; credentials never reach the client. */
export async function embedStudyText(text: string, options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
  if (!text.trim()) return { provider: 'lexical', values: null };
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = Math.max(500, Math.min(20000, options.timeoutMs ?? 9000));
  if (env.STUDY_EMBEDDING_URL && env.STUDY_EMBEDDING_API_KEY && env.STUDY_EMBEDDING_MODEL) {
    try {
      const response = await requestVector(env.STUDY_EMBEDDING_URL, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.STUDY_EMBEDDING_API_KEY },
        body: JSON.stringify({ model: env.STUDY_EMBEDDING_MODEL, input: text, dimensions: DIMENSIONS }),
      }, fetcher, timeoutMs) as { data?: Array<{ embedding?: unknown }>; embedding?: unknown; values?: unknown };
      return { provider: 'external', values: normalizeEmbedding(response.data?.[0]?.embedding ?? response.embedding ?? response.values) };
    } catch (error) {
      console.warn('External study embedding unavailable; attempting Gemini', error instanceof Error ? error.message : 'unknown');
    }
  }
  const key = env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (key) {
    try {
      const response = await requestVector('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text }] },
          taskType: options.taskType ?? 'RETRIEVAL_DOCUMENT',
          outputDimensionality: DIMENSIONS,
        }),
      }, fetcher, timeoutMs) as { embedding?: { values?: unknown } };
      return { provider: 'gemini', values: normalizeEmbedding(response.embedding?.values) };
    } catch (error) {
      console.warn('Gemini study embedding unavailable; using lexical search', error instanceof Error ? error.message : 'unknown');
    }
  }
  return { provider: 'lexical', values: null };
}

export function lexicalSimilarity(left: string, right: string): number {
  const words = (text: string) => new Set((text.toLocaleLowerCase('en').match(/[\p{L}\p{N}]+/gu) || []).filter((word) => word.length > 1));
  const a = words(left);
  const b = words(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  return intersection / (a.size + b.size - intersection);
}
