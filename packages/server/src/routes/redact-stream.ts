import { encodeSse, SseParser } from '@one-router/core';
import { PROVIDER_ERROR_MESSAGE } from '../errors';

function sanitize(data: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return data;
  }
  if (!parsed || typeof parsed !== 'object') return data;
  const value = parsed as Record<string, unknown>;
  if (typeof value.error !== 'string') return data;
  return JSON.stringify({ error: PROVIDER_ERROR_MESSAGE });
}

export function redactEventStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const parser = new SseParser();
  const emit = (controller: ReadableStreamDefaultController<Uint8Array>, events: ReturnType<SseParser['push']>) => {
    for (const event of events) {
      controller.enqueue(encoder.encode(`data: ${sanitize(event.data)}\n\n`));
    }
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          emit(controller, parser.push(decoder.decode(value, { stream: true })));
        }
        emit(controller, parser.push(decoder.decode()));
        emit(controller, parser.flush());
        controller.close();
      } catch {
        try {
          controller.enqueue(encoder.encode(encodeSse({
            error: PROVIDER_ERROR_MESSAGE,
          })));
        } catch {
          // The client may already be gone.
        }
        try {
          controller.close();
        } catch {
          // The stream may already be closed.
        }
      } finally {
        reader.releaseLock();
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
