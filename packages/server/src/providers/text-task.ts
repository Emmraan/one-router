import { chatCompletion, type FetchLike } from '@one-router/core';
import { HttpError } from '../errors';
import type { ResolvedProvider } from './resolve';

// Use the same adapters and URL policy as chat so custom providers behave consistently.
export async function runTextTask(options: { provider: ResolvedProvider; model: string; instruction: string; input: string; fetch?: FetchLike; signal: AbortSignal; maxOutput: number }) {
  const stream = await chatCompletion({ ...options.provider, model: options.model, messages: [
    { id: 'task-instruction', role: 'system', content: options.instruction, timestamp: 0 },
    { id: 'task-input', role: 'user', content: options.input, timestamp: 0 },
  ] }, { fetch: options.fetch, signal: options.signal });
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let result = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      if (done && pending) lines.push(pending);
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const event = JSON.parse(line.slice(5)) as { text?: string; error?: string };
        if (event.error) throw new Error('Provider task failed');
        result += event.text ?? '';
        if (result.length > options.maxOutput) throw new HttpError(502, 'Provider response exceeds the output limit', 'OUTPUT_TOO_LARGE');
      }
      if (done) break;
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  if (!result.trim()) throw new HttpError(502, 'Provider returned an empty response', 'EMPTY_RESPONSE');
  return result.trim();
}
