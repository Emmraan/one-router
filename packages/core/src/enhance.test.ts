import { describe, expect, it } from 'vitest';
import { enhancePrompt } from './enhance';
import { CoreError } from './errors';
import type { FetchLike } from './types';

function jsonFetch(body: unknown, status = 200): FetchLike {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

describe('enhancePrompt', () => {
  it('requires a configured provider instead of faking a rewrite', async () => {
    await expect(enhancePrompt({ prompt: 'explain closures' })).rejects.toMatchObject({
      code: 'PROVIDER_REQUIRED',
    });
  });

  it('returns the model rewrite when available', async () => {
    const enhanced = await enhancePrompt({
      prompt: 'write tests',
      apiKey: 'key',
      fetch: jsonFetch({
        candidates: [{ content: { parts: [{ text: '  Write thorough tests.  ' }] } }],
      }),
    });
    expect(enhanced).toBe('Write thorough tests.');
  });

  it('rejects when the upstream fails', async () => {
    await expect(
      enhancePrompt({
        prompt: 'keep me',
        apiKey: 'key',
        fetch: jsonFetch({ error: 'nope' }, 500),
      }),
    ).rejects.toBeInstanceOf(CoreError);
  });

  it('rejects a malformed response instead of silently using the input', async () => {
    await expect(
      enhancePrompt({
        prompt: 'keep me too',
        apiKey: 'key',
        fetch: jsonFetch({ candidates: [] }),
      }),
    ).rejects.toBeInstanceOf(CoreError);
  });

  it('rejects when fetch throws', async () => {
    await expect(
      enhancePrompt({
        prompt: 'still here',
        apiKey: 'key',
        fetch: async () => {
          throw new Error('offline');
        },
      }),
    ).rejects.toThrow('offline');
  });

  it('rejects an empty prompt', async () => {
    await expect(enhancePrompt({ prompt: '   ' })).rejects.toBeInstanceOf(CoreError);
  });
});
