import type { ModelAlias } from './types';

export interface ModelRef {
  provider: string;
  model: string;
}

export function parseModelRef(input: string): ModelRef | null {
  const trimmed = input.trim();
  const slash = trimmed.indexOf('/');
  if (slash <= 0 || slash === trimmed.length - 1) return null;

  const provider = trimmed.slice(0, slash).trim();
  const model = trimmed.slice(slash + 1).trim();
  if (!provider || !model || model.startsWith('/')) return null;
  if (/\s/.test(provider) || /\s/.test(model)) return null;

  return { provider, model };
}

export function formatModelRef(ref: ModelRef): string {
  return `${ref.provider}/${ref.model}`;
}

export function resolveModelAlias(model: string, aliases: readonly ModelAlias[]): string {
  return aliases.find((entry) => entry.alias === model)?.target ?? model;
}

export function normalizeModelName(name: string): string {
  return name.trim().replace(/^models\//, '');
}
