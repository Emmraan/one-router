import { describe, expect, it } from 'vitest';
import type { FetchLike } from './types';
import { deriveTitle, generateTitle, normalizeTitle } from './titles';

function jsonFetch(body: unknown, status = 200): FetchLike {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

function geminiText(text: string): unknown {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

describe('deriveTitle', () => {
  it.each([
    ['hello world', 'hello world'],
    ['one two three four five', 'one two three four five'],
    ['one two three four five six', 'one two three four five...'],
    ['  spaced   out   words  ', 'spaced out words'],
    ['line\nbreak', 'line break'],
    ['', 'New Chat'],
    ['   ', 'New Chat'],
  ])('derives %j', (message, expected) => {
    expect(deriveTitle(message)).toBe(expected);
  });
});

describe('normalizeTitle', () => {
  it.each([
    ['  "Hello World"  ', 'Hello World'],
    ["'A title'", 'A title'],
    ['`Backticked`', 'Backticked'],
    ['Title: My Chat', 'My Chat'],
    ['   ', 'New Chat'],
    ['""', 'New Chat'],
  ])('normalizes %j', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it('caps very long titles', () => {
    const title = normalizeTitle('word '.repeat(40));
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('...')).toBe(true);
  });
});

describe('generateTitle', () => {
  it('uses the local heuristic when no key is configured', async () => {
    expect(await generateTitle({ message: 'one two three four five six' })).toBe(
      'one two three four five...',
    );
  });

  it('returns New Chat for an empty message', async () => {
    expect(await generateTitle({ message: '   ', apiKey: 'key' })).toBe('New Chat');
  });

  it('uses the model title and strips quotes', async () => {
    const title = await generateTitle({
      message: 'how do I center a div',
      apiKey: 'key',
      fetch: jsonFetch(geminiText('"Center A Div"')),
    });
    expect(title).toBe('Center A Div');
  });

  it('asks for a short, language-aware title', async () => {
    let body = '';
    const fetch: FetchLike = async (_url, init) => {
      body = String(init?.body ?? '');
      return new Response(JSON.stringify(geminiText('A Fine Title')), {
        status: 200,
      });
    };

    await generateTitle({ message: 'hola mundo', apiKey: 'key', fetch });
    expect(body).toContain('3 to 6 words');
    expect(body).toContain('same language');
  });

  it('falls back to the message when the upstream fails', async () => {
    const title = await generateTitle({
      message: 'fallback please',
      apiKey: 'key',
      fetch: jsonFetch({ error: 'nope' }, 500),
    });
    expect(title).toBe('fallback please');
  });

  it('falls back when the response is malformed', async () => {
    const title = await generateTitle({
      message: 'malformed response',
      apiKey: 'key',
      fetch: jsonFetch({ candidates: [] }),
    });
    expect(title).toBe('malformed response');
  });

  it('falls back when fetch throws', async () => {
    const title = await generateTitle({
      message: 'network down',
      apiKey: 'key',
      fetch: async () => {
        throw new Error('offline');
      },
    });
    expect(title).toBe('network down');
  });
});
