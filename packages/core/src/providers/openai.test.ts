import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '../types';
import { openaiAdapter } from './openai';

const base: ChatRequest = {
  providerType: 'openai',
  model: 'gpt-4o',
  messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }],
};

function bodyOf(request: { body?: string }): unknown {
  return JSON.parse(request.body ?? '{}');
}

describe('openaiAdapter', () => {
  it('builds the default chat request', () => {
    const request = openaiAdapter.buildChatRequest(base);
    expect(request).toMatchObject({
      url: 'https://api.openai.com/v1/chat/completions',
      method: 'POST',
    });
    expect(request.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(bodyOf(request)).toEqual({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });
  });

  it('adds bearer auth and custom headers', () => {
    const request = openaiAdapter.buildChatRequest({
      ...base,
      apiKey: 'sk-test',
      customHeaders: { 'X-Test': 'one' },
    });
    expect(request.headers).toMatchObject({
      Authorization: 'Bearer sk-test',
      'X-Test': 'one',
    });
  });

  it('normalizes a trailing slash in the base URL', () => {
    const request = openaiAdapter.buildChatRequest({
      ...base,
      baseUrl: 'https://proxy.example.com/v1/',
    });
    expect(request.url).toBe('https://proxy.example.com/v1/chat/completions');
  });

  it('maps image and file attachments like the old route', () => {
    const request = openaiAdapter.buildChatRequest({
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
              size: 2048,
              url: 'blob:photo',
              base64: 'AAAA',
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
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'look' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,AAAA' },
            },
            { type: 'text', text: '\n[Attached File: doc.pdf (2 KB)]' },
          ],
        },
      ],
    });
  });

  it('falls back to the attachment URL when base64 is missing', () => {
    const request = openaiAdapter.buildChatRequest({
      ...base,
      messages: [
        {
          ...base.messages[0],
          attachments: [
            {
              id: 'a1',
              name: 'photo.png',
              type: 'image/png',
              size: 10,
              url: 'https://example.com/photo.png',
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(bodyOf(request))).toContain('https://example.com/photo.png');
  });

  it('blocks a loopback base URL for the OpenAI preset', () => {
    expect(() =>
      openaiAdapter.buildChatRequest({ ...base, baseUrl: 'http://localhost:1234/v1' }),
    ).toThrowError(expect.objectContaining({ code: 'BLOCKED_URL' }));
  });

  it('parses streamed text and ignores non-content events', () => {
    const parse = openaiAdapter.createStreamParser();
    expect(parse('data: {"choices":[{"delta":{"content":"Hel"}}]}')).toBe('Hel');
    expect(parse('data: {"choices":[{"delta":{"content":""}}]}')).toBeNull();
    expect(parse('data: [DONE]')).toBeNull();
    expect(parse('event: ping')).toBeNull();
    expect(parse('data: not json')).toBeNull();
  });

  it('surfaces an upstream error event', () => {
    const parse = openaiAdapter.createStreamParser();
    expect(() => parse('data: {"error":{"message":"bad key"}}')).toThrowError(
      expect.objectContaining({ code: 'UPSTREAM_ERROR' }),
    );
  });

  it('builds the discovery request', () => {
    const [request] = openaiAdapter.buildDiscoveryRequests({
      providerType: 'openai',
      apiKey: 'sk-test',
    });
    expect(request).toMatchObject({
      url: 'https://api.openai.com/v1/models',
      method: 'GET',
      headers: { Authorization: 'Bearer sk-test' },
    });
  });

  it('parses discovery ids and ignores malformed entries', () => {
    expect(
      openaiAdapter.parseDiscoveryResponse({
        data: [{ id: 'b' }, { id: 'a' }, { id: 3 }, null],
      }),
    ).toEqual(['b', 'a']);
  });

  it('blocks discovery on loopback for the OpenAI preset', () => {
    expect(() =>
      openaiAdapter.buildDiscoveryRequests({
        providerType: 'openai',
        baseUrl: 'http://127.0.0.1:1234/v1',
      }),
    ).toThrowError(expect.objectContaining({ code: 'BLOCKED_URL' }));
  });
});
