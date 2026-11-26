import { describe, expect, it } from 'vitest';
import { PROVIDER_DEFAULTS } from './types';

describe('PROVIDER_DEFAULTS', () => {
  it('locks the provider presets used by the app', () => {
    expect(PROVIDER_DEFAULTS).toEqual({
      openai: {
        name: 'OpenAI Compatible',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o3-mini'],
      },
      anthropic: {
        name: 'Anthropic Compatible',
        baseUrl: 'https://api.anthropic.com/v1',
        models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
      },
      gemini: {
        name: 'Gemini (Direct AI Studio)',
        baseUrl: 'https://generativelanguage.googleapis.com',
        models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-exp', 'gemini-1.5-flash'],
      },
      ollama: {
        name: 'Ollama (Local)',
        baseUrl: 'http://localhost:11434',
        models: ['llama3', 'mistral', 'gemma', 'phi3'],
      },
    });
  });
});
