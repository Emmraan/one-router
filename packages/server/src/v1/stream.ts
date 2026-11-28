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
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      reader = stream.getReader();
      const parser = new SseParser();
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
        chunk({ role: 'assistant', content: '' }, null);
        while (true) {
          const { done: finished, value } = await reader.read();
          if (finished) break;
          for (const event of parser.push(decoder.decode(value, { stream: true }))) {
            const text = eventText(event.data);
            if (text) chunk({ content: text }, null);
          }
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
        done();
      } catch {
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
      } finally {
        reader?.releaseLock();
      }
    },
    cancel(reason) {
      return reader?.cancel(reason);
    },
  });
}

export async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        const piece = eventText(event.data);
        text += piece;
        if (Buffer.byteLength(text, 'utf8') > 8 * 1024 * 1024) {
          throw new HttpError(502, 'Upstream response exceeded the size limit', 'UPSTREAM_ERROR');
        }
      }
    }
    for (const event of parser.push(decoder.decode())) {
      text += eventText(event.data);
    }
    for (const event of parser.flush()) text += eventText(event.data);
    return text;
  } finally {
    reader.releaseLock();
  }
}
