import { describe, expect, it } from 'vitest';
import type { ChatRequest, FetchLike } from '../types';
import { geminiAdapter, generateGeminiText } from './gemini';

const base: ChatRequest = {
  providerType: 'gemini',
  model: 'gemini-2.5-flash',
  messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }],
};

function bodyOf(request: { body?: string }): unknown {
  return JSON.parse(request.body ?? '{}');
}

describe('geminiAdapter', () => {
  it('builds the default chat request', () => {
    const request = geminiAdapter.buildChatRequest({ ...base, apiKey: 'key' });
    expect(request.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=key',
    );
    expect(request.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(bodyOf(request)).toEqual({
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      config: {},
    });
  });

  it('maps system and assistant messages like the old route', () => {
    const request = geminiAdapter.buildChatRequest({
      ...base,
      messages: [
        { id: 'u1', role: 'user', content: 'hi', timestamp: 1 },
        { id: 's1', role: 'system', content: 'be nice', timestamp: 2 },
        { id: 'a1', role: 'assistant', content: 'hello', timestamp: 3 },
      ],
    });
    expect(bodyOf(request)).toEqual({
      contents: [
        { role: 'user', parts: [{ text: 'hi' }] },
        { role: 'user', parts: [{ text: 'be nice' }] },
        { role: 'model', parts: [{ text: 'hello' }] },
      ],
      config: { systemInstruction: { parts: [{ text: 'be nice' }] } },
    });
  });

  it('maps image attachments and strips a data URL prefix', () => {
    const request = geminiAdapter.buildChatRequest({
      ...base,
      messages: [
        {
          ...base.messages[0],
          content: 'look',
          attachments: [
            {
              id: 'a1',
              name: 'photo.png',
              type: 'image/png',
              size: 10,
              url: 'blob:photo',
              base64: 'data:image/png;base64,AAAA',
            },
            {
              id: 'a2',
              name: 'doc.pdf',
              type: 'application/pdf',
              size: 2048,
              url: 'blob:doc',
            },
          ],
        },
      ],
    });

    expect(bodyOf(request)).toMatchObject({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'look' },
            { inlineData: { mimeType: 'image/png', data: 'AAAA' } },
            { text: '\n[Attached File: doc.pdf (2 KB)]' },
          ],
        },
      ],
    });
  });

  it('defaults the model when one is not provided', () => {
    const request = geminiAdapter.buildChatRequest({ ...base, model: '' });
    expect(request.url).toContain('/models/gemini-2.5-flash:streamGenerateContent');
  });

  it('parses array-wrapped chunks and joins parts', () => {
    const parse = geminiAdapter.createStreamParser();
    expect(
      parse(
        '[{"candidates":[{"content":{"parts":[{"text":"Hel"},{"text":"lo"}]}}]},',
      ),
    ).toBe('Hello');
    expect(parse('{"candidates":[{"content":{"parts":[{"text":"Hi"}]}}]}]')).toBe('Hi');
    expect(parse(']')).toBeNull();
    expect(parse('not json')).toBeNull();
  });

  it('surfaces an upstream error event', () => {
    const parse = geminiAdapter.createStreamParser();
    expect(() => parse('{"error":{"message":"quota"}}')).toThrowError(
      expect.objectContaining({ code: 'UPSTREAM_ERROR' }),
    );
  });

  it('builds the discovery request', () => {
    const [request] = geminiAdapter.buildDiscoveryRequests({
      providerType: 'gemini',
      apiKey: 'key',
    });
    expect(request).toMatchObject({
      url: 'https://generativelanguage.googleapis.com/v1beta/models?key=key',
      method: 'GET',
    });
  });

  it('strips the models prefix and filters unsupported models', () => {
    expect(
      geminiAdapter.parseDiscoveryResponse({
        models: [
          { name: 'models/gemini-2.5-flash' },
          { name: 'models/embedding-001' },
          { name: 'models/gemini-bidi' },
          { name: 'models/text-classifier' },
          { name: 'models/gemini-2.5-pro' },
        ],
      }),
    ).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
  });
});

describe('generateGeminiText', () => {
  it('uses gemini-2.0-flash and joins text parts', async () => {
    let url = '';
    let body = '';
    const fetch: FetchLike = async (input, init) => {
      url = String(input);
      body = String(init?.body ?? '');
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Hello ' }, { text: 'world' }] } }],
        }),
        { status: 200 },
      );
    };

    expect(await generateGeminiText({ apiKey: 'key', prompt: 'hello', fetch })).toBe(
      'Hello world',
    );
    expect(url).toContain('/models/gemini-2.0-flash:generateContent');
    expect(url).toContain('key=key');
    expect(body).toContain('hello');
  });

  it('throws on a non-ok response', async () => {
    const fetch: FetchLike = async () => new Response('nope', { status: 429 });
    await expect(
      generateGeminiText({ apiKey: 'key', prompt: 'hello', fetch }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_STATUS', status: 429 });
  });

  it('throws on an empty response', async () => {
    const fetch: FetchLike = async () =>
      new Response(JSON.stringify({ candidates: [] }), { status: 200 });
    await expect(
      generateGeminiText({ apiKey: 'key', prompt: 'hello', fetch }),
    ).rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
  });
});
