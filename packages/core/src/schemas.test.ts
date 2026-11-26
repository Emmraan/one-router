import { describe, expect, it } from 'vitest';
import {
  chatRequestSchema,
  discoveryRequestSchema,
  enhanceRequestSchema,
  providerSchema,
  titleRequestSchema,
} from './schemas';

const message = {
  id: 'm1',
  role: 'user',
  content: 'hello',
  timestamp: 1,
};

const chat = {
  providerType: 'openai',
  model: 'gpt-4o',
  messages: [message],
};

describe('chatRequestSchema', () => {
  it('accepts a minimal request', () => {
    expect(chatRequestSchema.safeParse(chat).success).toBe(true);
  });

  it('accepts headers as text or an object', () => {
    expect(
      chatRequestSchema.safeParse({ ...chat, customHeaders: 'X-Test: one\nX-Two: two' }).success,
    ).toBe(true);
    expect(
      chatRequestSchema.safeParse({ ...chat, customHeaders: { 'X-Test': 'one' } }).success,
    ).toBe(true);
  });

  it('accepts an attachment with or without base64', () => {
    const attachment = {
      id: 'a1',
      name: 'photo.png',
      type: 'image/png',
      size: 3,
      url: 'blob:test',
    };
    expect(
      chatRequestSchema.safeParse({
        ...chat,
        messages: [{ ...message, attachments: [attachment] }],
      }).success,
    ).toBe(true);
    expect(
      chatRequestSchema.safeParse({
        ...chat,
        messages: [{ ...message, attachments: [{ ...attachment, base64: 'AAAA' }] }],
      }).success,
    ).toBe(true);
  });

  it.each([
    ['missing provider', { ...chat, providerType: undefined }],
    ['unknown provider', { ...chat, providerType: 'nope' }],
    ['missing model', { ...chat, model: '' }],
    ['empty messages', { ...chat, messages: [] }],
    ['invalid role', { ...chat, messages: [{ ...message, role: 'tool' }] }],
    ['missing message id', { ...chat, messages: [{ ...message, id: '' }] }],
  ])('rejects %s', (_label, input) => {
    expect(chatRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe('discoveryRequestSchema', () => {
  it('accepts a provider', () => {
    expect(discoveryRequestSchema.safeParse({ providerType: 'ollama' }).success).toBe(true);
  });

  it('rejects a missing provider', () => {
    expect(discoveryRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('titleRequestSchema', () => {
  it('accepts an empty message so the route can return New Chat', () => {
    expect(titleRequestSchema.safeParse({ message: '' }).success).toBe(true);
  });

  it('rejects a missing message', () => {
    expect(titleRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('enhanceRequestSchema', () => {
  it('accepts a prompt', () => {
    expect(enhanceRequestSchema.safeParse({ prompt: 'x' }).success).toBe(true);
  });

  it('rejects an empty prompt', () => {
    expect(enhanceRequestSchema.safeParse({ prompt: '' }).success).toBe(false);
  });
});

describe('providerSchema', () => {
  const provider = {
    id: 'p1',
    name: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o'],
    isActive: true,
  };

  it('accepts a provider', () => {
    expect(providerSchema.safeParse(provider).success).toBe(true);
  });

  it('rejects a missing active flag', () => {
    const { isActive: _isActive, ...rest } = provider;
    expect(providerSchema.safeParse(rest).success).toBe(false);
  });
});
