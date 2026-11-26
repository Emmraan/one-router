import { describe, expect, it } from 'vitest';
import { CoreError } from '../errors';
import type { ChatRequest, FetchLike } from '../types';
import {
  chatCompletion,
  discoverModels,
  getProviderAdapter,
  parseCustomHeaders,
} from './registry';

const chat: ChatRequest = {
  providerType: 'openai',
  model: 'gpt-4o',
  messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }],
  apiKey: 'sk-test',
};

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('getProviderAdapter', () => {
  it.each(['openai', 'anthropic', 'gemini', 'ollama'] as const)('returns the %s adapter', (type) => {
    expect(getProviderAdapter(type).type).toBe(type);
  });

  it('rejects an unknown provider', () => {
    expect(() => getProviderAdapter('nope')).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_PROVIDER' }),
    );
  });

  it('rejects inherited object keys as provider types', () => {
    expect(() => getProviderAdapter('toString')).toThrowError(
      expect.objectContaining({ code: 'UNSUPPORTED_PROVIDER' }),
    );
  });
});

describe('parseCustomHeaders', () => {
  it('parses a JSON object string', () => {
    expect(parseCustomHeaders('{"X-One":"1","X-Two":"2"}')).toEqual({
      'X-One': '1',
      'X-Two': '2',
    });
  });

  it('parses newline-separated pairs', () => {
    expect(parseCustomHeaders('X-One: 1\nX-Two: 2')).toEqual({
      'X-One': '1',
      'X-Two': '2',
    });
  });

  it('falls back to newline parsing when JSON is invalid', () => {
    expect(parseCustomHeaders('{oops\nX-One: 1')).toEqual({ 'X-One': '1' });
  });

  it('accepts an object and ignores non-string values', () => {
    expect(parseCustomHeaders({ 'X-One': '1', 'X-Two': 2 })).toEqual({ 'X-One': '1' });
  });

  it('returns an empty object for empty input', () => {
    expect(parseCustomHeaders(undefined)).toEqual({});
    expect(parseCustomHeaders('')).toEqual({});
  });

  it('accepts CRLF-separated pairs', () => {
    expect(parseCustomHeaders('X-One: 1\r\nX-Two: 2')).toEqual({
      'X-One': '1',
      'X-Two': '2',
    });
  });

  it('rejects header injection in object values and names', () => {
    expect(() => parseCustomHeaders({ 'X-One': 'a\r\nX-Two: b' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_REQUEST' }),
    );
    expect(() => parseCustomHeaders({ 'X\rBad': 'a' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_REQUEST' }),
    );
  });

  it('rejects hop-by-hop headers', () => {
    expect(() => parseCustomHeaders('Host: evil.test')).toThrowError(
      expect.objectContaining({ code: 'INVALID_REQUEST' }),
    );
  });
});

describe('chatCompletion', () => {
  it('normalizes an upstream stream to text SSE', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: FetchLike = async (url, init) => {
      calls.push({ url: String(url), init });
      return textResponse(
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n' +
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
          'data: [DONE]\n\n',
      );
    };

    const stream = await chatCompletion(chat, { fetch });
    expect(await readAll(stream)).toBe(
      'data: {"text":"Hel"}\n\ndata: {"text":"lo"}\n\n',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.redirect).toBe('manual');
  });

  it('returns the upstream status and body on failure', async () => {
    const fetch: FetchLike = async () => textResponse('bad key', 401);
    await expect(chatCompletion(chat, { fetch })).rejects.toMatchObject({
      code: 'UPSTREAM_STATUS',
      status: 401,
      message: expect.stringContaining('bad key'),
    });
  });

  it('rejects a redirect instead of following it', async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return new Response('', {
        status: 302,
        headers: { Location: 'http://169.254.169.254/latest/meta-data' },
      });
    };

    await expect(chatCompletion(chat, { fetch })).rejects.toMatchObject({
      code: 'UPSTREAM_STATUS',
      status: 502,
    });
    expect(calls).toBe(1);
  });

  it('rejects a response without a body', async () => {
    const fetch: FetchLike = async () => new Response(null, { status: 200 });
    await expect(chatCompletion(chat, { fetch })).rejects.toMatchObject({
      code: 'EMPTY_RESPONSE',
    });
  });

  it('wraps a network failure', async () => {
    const fetch: FetchLike = async () => {
      throw new Error('offline');
    };
    await expect(chatCompletion(chat, { fetch })).rejects.toMatchObject({
      code: 'UPSTREAM_ERROR',
      message: 'offline',
    });
  });

  it('reports an aborted request', async () => {
    const fetch: FetchLike = async () => {
      throw new DOMException('Aborted', 'AbortError');
    };
    await expect(chatCompletion(chat, { fetch })).rejects.toMatchObject({
      code: 'ABORTED',
      status: 499,
    });
  });

  it('emits an SSE error frame when the upstream stream breaks', async () => {
    let pulled = false;
    const fetch: FetchLike = async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            if (!pulled) {
              pulled = true;
              controller.enqueue(
                new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'),
              );
              return;
            }
            controller.error(new Error('boom'));
          },
        }),
        { status: 200 },
      );

    const stream = await chatCompletion(chat, { fetch });
    const output = await readAll(stream);
    expect(output).toContain('data: {"text":"Hi"}');
    expect(output).toContain('data: {"error":"boom"}');
  });

  it('stops a stream line that exceeds the buffer cap', async () => {
    const fetch: FetchLike = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('x'.repeat(1_100_000)));
            controller.close();
          },
        }),
        { status: 200 },
      );

    const stream = await chatCompletion(chat, { fetch });
    const output = await readAll(stream);
    expect(output).toContain('data: {"error"');
    expect(output).toContain('1 MiB limit');
  });

  it('rejects an unknown provider at runtime', async () => {
    const bad = { ...chat, providerType: 'nope' } as unknown as ChatRequest;
    await expect(chatCompletion(bad)).rejects.toBeInstanceOf(CoreError);
  });
});

describe('discoverModels', () => {
  it('sorts discovered models', async () => {
    const fetch: FetchLike = async () =>
      new Response(JSON.stringify({ data: [{ id: 'b' }, { id: 'a' }] }), { status: 200 });
    expect(await discoverModels({ providerType: 'openai' }, { fetch })).toEqual({
      success: true,
      models: ['a', 'b'],
    });
  });

  it('falls back to the Ollama models endpoint after a non-ok response', async () => {
    const urls: string[] = [];
    const fetch: FetchLike = async (url) => {
      urls.push(String(url));
      if (urls.length === 1) return new Response('missing', { status: 404 });
      return new Response(JSON.stringify({ data: [{ id: 'llama3' }] }), { status: 200 });
    };

    expect(await discoverModels({ providerType: 'ollama' }, { fetch })).toEqual({
      success: true,
      models: ['llama3'],
    });
    expect(urls).toHaveLength(2);
  });

  it('returns the preset message when nothing is found', async () => {
    const fetch: FetchLike = async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 });
    expect(await discoverModels({ providerType: 'openai' }, { fetch })).toEqual({
      success: false,
      error: 'No models found dynamically. Proceeded with preset defaults.',
    });
  });

  it('returns a network error message', async () => {
    const fetch: FetchLike = async () => {
      throw new Error('offline');
    };
    expect(await discoverModels({ providerType: 'openai' }, { fetch })).toEqual({
      success: false,
      error: 'offline',
    });
  });

  it('rejects an unknown provider', async () => {
    await expect(
      discoverModels({ providerType: 'nope' } as never),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_PROVIDER' });
  });
});
