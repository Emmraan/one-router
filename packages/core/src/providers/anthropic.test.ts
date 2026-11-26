import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '../types';
import { anthropicAdapter } from './anthropic';

const base: ChatRequest = {
  providerType: 'anthropic',
  model: 'claude-3-5-sonnet-latest',
  messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }],
};

function bodyOf(request: { body?: string }): unknown {
  return JSON.parse(request.body ?? '{}');
}

describe('anthropicAdapter', () => {
  it('builds the default chat request', () => {
    const request = anthropicAdapter.buildChatRequest(base);
    expect(request).toMatchObject({
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
    });
    expect(request.headers).toMatchObject({
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    });
    expect(bodyOf(request)).toEqual({
      model: 'claude-3-5-sonnet-latest',
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 4096,
      stream: true,
    });
  });

  it('moves system messages into the system prompt', () => {
    const request = anthropicAdapter.buildChatRequest({
      ...base,
      messages: [
        { id: 's1', role: 'system', content: 'You are helpful', timestamp: 1 },
        { id: 's2', role: 'system', content: 'Be brief', timestamp: 2 },
        { id: 'u1', role: 'user', content: 'hi', timestamp: 3 },
        { id: 'a1', role: 'assistant', content: 'hello', timestamp: 4 },
      ],
    });
    expect(bodyOf(request)).toMatchObject({
      system: 'You are helpful\nBe brief',
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
    });
  });

  it('adds the API key header when present', () => {
    const request = anthropicAdapter.buildChatRequest({ ...base, apiKey: 'key' });
    expect(request.headers).toMatchObject({ 'x-api-key': 'key' });
  });

  it('maps image attachments and strips a data URL prefix', () => {
    const request = anthropicAdapter.buildChatRequest({
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
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'look' },
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: 'AAAA' },
            },
            { type: 'text', text: '\n[Attached File: doc.pdf (2 KB)]' },
          ],
        },
      ],
    });
  });

  it('blocks a loopback base URL', () => {
    expect(() =>
      anthropicAdapter.buildChatRequest({ ...base, baseUrl: 'http://localhost:1234/v1' }),
    ).toThrowError(expect.objectContaining({ code: 'BLOCKED_URL' }));
  });

  it('parses content deltas and ignores other events', () => {
    const parse = anthropicAdapter.createStreamParser();
    expect(
      parse('data: {"type":"content_block_delta","delta":{"text":"Hi"}}'),
    ).toBe('Hi');
    expect(parse('data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}')).toBeNull();
    expect(parse('event: ping')).toBeNull();
    expect(parse('data: not json')).toBeNull();
  });

  it('surfaces an upstream error event', () => {
    const parse = anthropicAdapter.createStreamParser();
    expect(() =>
      parse('data: {"type":"error","error":{"message":"overloaded"}}'),
    ).toThrowError(expect.objectContaining({ code: 'UPSTREAM_ERROR' }));
  });

  it('builds the discovery request with the Anthropic headers', () => {
    const [request] = anthropicAdapter.buildDiscoveryRequests({
      providerType: 'anthropic',
      apiKey: 'key',
    });
    expect(request).toMatchObject({
      url: 'https://api.anthropic.com/v1/models',
      method: 'GET',
      headers: { 'anthropic-version': '2023-06-01', 'x-api-key': 'key' },
    });
  });

  it('does not duplicate /v1 when the base URL already includes it', () => {
    const [request] = anthropicAdapter.buildDiscoveryRequests({
      providerType: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1/',
      apiKey: 'key',
    });
    expect(request.url).toBe('https://api.anthropic.com/v1/models');
  });

  it('parses both discovery response shapes', () => {
    expect(anthropicAdapter.parseDiscoveryResponse({ data: [{ id: 'b' }, { id: 'a' }] })).toEqual([
      'b',
      'a',
    ]);
    expect(anthropicAdapter.parseDiscoveryResponse([{ id: 'b' }, 'a'])).toEqual(['b', 'a']);
  });
});
