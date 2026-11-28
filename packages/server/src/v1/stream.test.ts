import { describe, expect, it } from 'vitest';
import { encodeSse } from '@one-router/core';
import { collectStream, openAiStream } from './stream';
import { redactEventStream } from '../routes/redact-stream';

const encoder = new TextEncoder();

describe('provider stream lifecycle', () => {
  it.each(['gateway', 'chat'] as const)('%s preserves backpressure and cancellation', async (target) => {
    let pulls = 0;
    let cancelled = false;
    const source = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(encoder.encode(encodeSse({ text: 'Hi' })));
        if (pulls === 100) controller.close();
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const stream = target === 'chat' ? redactEventStream(source)
      : openAiStream(source, { id: 'fixture', model: 'fixture', created: 0 });
    for (let i = 0; i < 30; i += 1) await Promise.resolve();
    try {
      expect(pulls).toBeLessThanOrEqual(2);
    } finally {
      await stream.cancel();
    }
    expect(cancelled).toBe(true);
  });

  it('cancels the upstream when non-streaming collection exceeds its cap', async () => {
    let cancelled = false;
    const source = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(encoder.encode(encodeSse({ text: 'x'.repeat(512 * 1024) })));
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    await expect(collectStream(source)).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
    expect(cancelled).toBe(true);
  });
});
