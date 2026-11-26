import { describe, expect, it } from 'vitest';
import {
  formatModelRef,
  normalizeModelName,
  parseModelRef,
  resolveModelAlias,
} from './models';

describe('parseModelRef', () => {
  it.each([
    ['openai/gpt-4o', { provider: 'openai', model: 'gpt-4o' }],
    [' ollama/llama3.1:8b ', { provider: 'ollama', model: 'llama3.1:8b' }],
    [
      'openrouter/meta-llama/llama-3',
      { provider: 'openrouter', model: 'meta-llama/llama-3' },
    ],
  ])('parses %s', (input, expected) => {
    expect(parseModelRef(input)).toEqual(expected);
  });

  it.each(['', 'gpt-4o', '/gpt-4o', 'openai/', 'openai//gpt-4o', ' / '])(
    'rejects %s',
    (input) => {
      expect(parseModelRef(input)).toBeNull();
    },
  );
});

describe('formatModelRef', () => {
  it('joins provider and model', () => {
    expect(formatModelRef({ provider: 'openai', model: 'gpt-4o' })).toBe(
      'openai/gpt-4o',
    );
  });
});

describe('resolveModelAlias', () => {
  const aliases = [
    { alias: 'fast', target: 'openai/gpt-4o-mini' },
    { alias: 'smart', target: 'anthropic/claude-3-5-sonnet-latest' },
  ];

  it('resolves a known alias', () => {
    expect(resolveModelAlias('fast', aliases)).toBe('openai/gpt-4o-mini');
  });

  it('leaves an unknown value unchanged', () => {
    expect(resolveModelAlias('openai/gpt-4o', aliases)).toBe('openai/gpt-4o');
  });

  it('is case-sensitive', () => {
    expect(resolveModelAlias('FAST', aliases)).toBe('FAST');
  });
});

describe('normalizeModelName', () => {
  it.each([
    ['models/gemini-2.5-flash', 'gemini-2.5-flash'],
    [' gemini-2.5-flash ', 'gemini-2.5-flash'],
    ['models/models/x', 'models/x'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeModelName(input)).toBe(expected);
  });
});
