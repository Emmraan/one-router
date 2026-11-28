import { describe, expect, it } from 'vitest';
import { chatCompletion, discoverModels } from './registry';

const encoder = new TextEncoder();
const input = {
  providerType: 'openai' as const,
  model: 'fixture',
  messages: [{ id: 'm', role: 'user' as const, content: 'Hi', timestamp: 1 }],
};

describe('provider response resource limits', () => {
  it('does not drain a provider stream while the consumer is idle', async () => {
    let pulls = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
        if (pulls === 100) controller.close();
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const stream = await chatCompletion(input, { fetch: async () => new Response(body) });
    for (let i = 0; i < 30; i += 1) await Promise.resolve();
    try {
      expect(pulls).toBeLessThanOrEqual(2);
    } finally {
      await stream.cancel();
    }
    expect(cancelled).toBe(true);
  });

  it('cancels an oversized discovery body even when Content-Length lies', async () => {
    let sent = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < 4) controller.enqueue(encoder.encode(' '.repeat(1024 * 1024)));
        else {
          controller.enqueue(encoder.encode('{"data":[{"id":"model"}]}'));
          controller.close();
        }
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 });
    const result = await discoverModels({ providerType: 'openai' }, {
      fetch: async () => new Response(body, { headers: { 'Content-Length': '1' } }),
    });
    expect(result.success).toBe(false);
    expect(cancelled).toBe(true);
    expect(sent).toBeLessThanOrEqual(3);
  });

  it('rejects a discovery response with ten thousand models', async () => {
    const body = JSON.stringify({ data: Array.from({ length: 10_000 }, (_, i) => ({ id: `model-${i}` })) });
    const result = await discoverModels({ providerType: 'openai' }, {
      fetch: async () => new Response(body),
    });
    expect(result.success).toBe(false);
  });
});
