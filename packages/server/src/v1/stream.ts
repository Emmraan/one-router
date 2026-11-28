import { encodeSse, SseParser } from '@one-router/core';
import { HttpError, PROVIDER_ERROR_MESSAGE } from '../errors';

function eventText(data: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return '';
  }
  if (!parsed || typeof parsed !== 'object') return '';
  const value = parsed as { text?: unknown; error?: unknown };
  if (typeof value.error === 'string') {
    throw new HttpError(502, PROVIDER_ERROR_MESSAGE, 'UPSTREAM_ERROR');
  }
  return typeof value.text === 'string' ? value.text : '';
}

export function openAiStream(stream: ReadableStream<Uint8Array>, options: {
  id: string;
  model: string;
  created: number;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  const parser = new SseParser();
  let ended = false;
  const stop = async (reason?: unknown) => {
    ended = true;
    try { await reader.cancel(reason); }
    finally { reader.releaseLock(); }
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse({
        id: options.id, object: 'chat.completion.chunk', created: options.created, model: options.model,
        choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
      })));
    },
    async pull(controller) {
      const chunk = (delta: Record<string, unknown>, finishReason: string | null) => {
        controller.enqueue(encoder.encode(encodeSse({
          id: options.id,
          object: 'chat.completion.chunk',
          created: options.created,
          model: options.model,
          choices: [{ index: 0, delta, finish_reason: finishReason }],
        })));
      };
      const done = () => {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      };
      try {
        while (!ended) {
          const { done: finished, value } = await reader.read();
          if (ended) return;
          if (finished) break;
          let emitted = false;
          for (const event of parser.push(decoder.decode(value, { stream: true }))) {
            const text = eventText(event.data);
            if (text) {
              chunk({ content: text }, null);
              emitted = true;
            }
          }
          if (emitted) return;
        }
        for (const event of parser.push(decoder.decode())) {
          const text = eventText(event.data);
          if (text) chunk({ content: text }, null);
        }
        for (const event of parser.flush()) {
          const text = eventText(event.data);
          if (text) chunk({ content: text }, null);
        }
        chunk({}, 'stop');
        ended = true;
        reader.releaseLock();
        done();
      } catch {
        if (ended) return;
        try { await stop(); } catch { /* A broken upstream may reject cancellation. */ }
        try {
          controller.enqueue(encoder.encode(encodeSse({
            error: {
              message: PROVIDER_ERROR_MESSAGE,
              type: 'one_router_error',
            },
          })));
          done();
        } catch {
          // The client may already be gone.
        }
      }
    },
    cancel: stop,
  });
}

export async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  let text = '';
  let bytes = 0;
  const append = (data: string) => {
    const piece = eventText(data);
    bytes += Buffer.byteLength(piece, 'utf8');
    if (bytes > 8 * 1024 * 1024) throw new HttpError(502, 'Upstream response exceeded the size limit', 'UPSTREAM_ERROR');
    text += piece;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        append(event.data);
      }
    }
    for (const event of parser.push(decoder.decode())) {
      append(event.data);
    }
    for (const event of parser.flush()) append(event.data);
    return text;
  } finally {
    try { await reader.cancel(); }
    finally { reader.releaseLock(); }
  }
}
