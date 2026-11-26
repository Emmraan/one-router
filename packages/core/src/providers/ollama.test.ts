import { describe, expect, it } from 'vitest';
import type { ChatRequest } from '../types';
import { ollamaAdapter } from './ollama';

const base: ChatRequest = {
  providerType: 'ollama',
  model: 'llama3',
  messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }],
};

function bodyOf(request: { body?: string }): unknown {
  return JSON.parse(request.body ?? '{}');
}

describe('ollamaAdapter', () => {
  it('builds the default local chat request', () => {
    const request = ollamaAdapter.buildChatRequest(base);
    expect(request).toMatchObject({
      url: 'http://localhost:11434/chat/completions',
      method: 'POST',
    });
    expect(request.headers).not.toHaveProperty('Authorization');
    expect(bodyOf(request)).toEqual({
      model: 'llama3',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });
  });

  it('allows explicit loopback addresses for the Ollama preset', () => {
    const request = ollamaAdapter.buildChatRequest({
      ...base,
      baseUrl: 'http://127.0.0.1:11434/',
    });
    expect(request.url).toBe('http://127.0.0.1:11434/chat/completions');
  });

  it('blocks a private LAN address', () => {
    expect(() =>
      ollamaAdapter.buildChatRequest({ ...base, baseUrl: 'http://192.168.1.5:11434' }),
    ).toThrowError(expect.objectContaining({ code: 'BLOCKED_URL' }));
  });

  it('adds bearer auth when a key is configured', () => {
    const request = ollamaAdapter.buildChatRequest({ ...base, apiKey: 'key' });
    expect(request.headers).toMatchObject({ Authorization: 'Bearer key' });
  });

  it('builds the tags request and the models fallback', () => {
    const requests = ollamaAdapter.buildDiscoveryRequests({ providerType: 'ollama' });
    expect(requests.map((request) => request.url)).toEqual([
      'http://localhost:11434/api/tags',
      'http://localhost:11434/v1/models',
    ]);
  });

  it('parses both tags and OpenAI-style model lists', () => {
    expect(
      ollamaAdapter.parseDiscoveryResponse({ models: [{ name: 'llama3' }, { name: 'mistral' }] }),
    ).toEqual(['llama3', 'mistral']);
    expect(
      ollamaAdapter.parseDiscoveryResponse({ data: [{ id: 'llama3' }, { id: 'phi3' }] }),
    ).toEqual(['llama3', 'phi3']);
  });

  it('parses OpenAI-compatible stream deltas', () => {
    const parse = ollamaAdapter.createStreamParser();
    expect(parse('data: {"choices":[{"delta":{"content":"Hi"}}]}')).toBe('Hi');
    expect(parse('data: [DONE]')).toBeNull();
  });
});
