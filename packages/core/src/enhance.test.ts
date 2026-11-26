import { describe, expect, it } from 'vitest';
import { ENHANCE_SUFFIX, enhancePrompt } from './enhance';
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
  it('appends the local instruction when no key is configured', async () => {
    expect(await enhancePrompt({ prompt: '  explain closures  ' })).toBe(
      `explain closures${ENHANCE_SUFFIX}`,
    );
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

  it('keeps the original prompt when the upstream fails', async () => {
    const enhanced = await enhancePrompt({
      prompt: 'keep me',
      apiKey: 'key',
      fetch: jsonFetch({ error: 'nope' }, 500),
    });
    expect(enhanced).toBe('keep me');
  });

  it('keeps the original prompt when the response is malformed', async () => {
    const enhanced = await enhancePrompt({
      prompt: 'keep me too',
      apiKey: 'key',
      fetch: jsonFetch({ candidates: [] }),
    });
    expect(enhanced).toBe('keep me too');
  });

  it('keeps the original prompt when fetch throws', async () => {
    const enhanced = await enhancePrompt({
      prompt: 'still here',
      apiKey: 'key',
      fetch: async () => {
        throw new Error('offline');
      },
    });
    expect(enhanced).toBe('still here');
  });

  it('rejects an empty prompt', async () => {
    await expect(enhancePrompt({ prompt: '   ' })).rejects.toBeInstanceOf(CoreError);
  });
});
