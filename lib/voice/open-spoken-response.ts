/** Do not commit to a provider until its stream contains actual spoken text. */
export async function openSpokenResponse(
  url: string, init: RequestInit,
  options: { timeoutMs: number; stream: boolean; onEmpty?: (usage: unknown) => void },
): Promise<Response> {
  const deadline = new AbortController();
  const signal = init.signal ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal;
  const timer = setTimeout(() => deadline.abort(new DOMException('Voice response timed out', 'TimeoutError')), options.timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  // A fetch can fail before the first read starts racing this promise.
  void aborted.catch(() => undefined);
  const onAbort = () => rejectAbort(signal.reason);
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    if (signal.aborted) throw signal.reason;
    const response = await fetch(url, { ...init, signal });
    if (!response.ok || !response.body || !options.stream) return response;
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    const decoder = new TextDecoder();
    let pending = '', bytes = 0, usage: unknown;
    const hasSpeech = (line: string) => {
      if (!line.startsWith('data:')) return false;
      try {
        const event = JSON.parse(line.slice(5).trim());
        if (event.usage || event.x_groq?.usage) usage = event;
        return event.choices?.some((choice: { delta?: { content?: unknown } }) =>
          typeof choice.delta?.content === 'string' && choice.delta.content.trim().length > 0);
      } catch { return false; }
    };
    let spoken = false;
    while (!spoken) {
      const item = await Promise.race([reader.read(), aborted]);
      if (item.done) {
        spoken = hasSpeech(pending);
        if (!spoken) {
          options.onEmpty?.(usage);
          reader.releaseLock();
          return new Response(null, { status: 502, statusText: 'No spoken output' });
        }
        break;
      }
      chunks.push(item.value); bytes += item.value.byteLength;
      if (bytes > 256_000) throw new Error('Voice preamble exceeded its buffer');
      pending += decoder.decode(item.value, { stream: true });
      let newline;
      while ((newline = pending.indexOf('\n')) >= 0) {
        spoken = hasSpeech(pending.slice(0, newline).replace(/\r$/, '')) || spoken;
        pending = pending.slice(newline + 1);
      }
    }
    const source = reader;
    // Replay the original bytes, including usage records and event boundaries.
    // The deadline ends at first text; it must not cut off a healthy lecture.
    return new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const buffered = chunks.shift();
          if (buffered) { controller.enqueue(buffered); return; }
          const next = await source.read();
          if (next.done) { source.releaseLock(); controller.close(); }
          else controller.enqueue(next.value);
        } catch (error) { controller.error(error); }
      },
      async cancel(reason) { deadline.abort(reason); await source.cancel(reason); },
    }), { status: response.status, headers: response.headers });
  } catch (error) {
    deadline.abort(error);
    await reader?.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
