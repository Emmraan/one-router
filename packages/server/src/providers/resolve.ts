import type { ProviderType } from '@one-router/core';
import type { ServerEnv } from '../env';
import { HttpError } from '../errors';
import type { createAuth } from '../middleware/auth';

export interface ProviderInput {
  providerId?: string;
  providerType?: ProviderType;
  baseUrl?: string;
  apiKey?: string;
  customHeaders?: Record<string, string> | string;
}

export interface ResolvedProvider {
  providerType: ProviderType;
  providerId?: string;
  baseUrl?: string;
  apiKey?: string;
  customHeaders?: Record<string, string> | string;
}

function environmentKey(env: ServerEnv, type: ProviderType): string | undefined {
  if (type === 'openai') return env.providerKeys.openai;
  if (type === 'anthropic') return env.providerKeys.anthropic;
  if (type === 'gemini') return env.providerKeys.gemini;
  return undefined;
}

export async function resolveGeminiKey(options: {
  repos: ReturnType<typeof createAuth>['repos'];
  env: ServerEnv;
  owner: string;
  apiKey?: string;
}): Promise<string | undefined> {
  if (options.apiKey) return options.apiKey;
  const providers = await options.repos.providers.list(options.owner);
  const match = providers.find((item) => item.type === 'gemini' && item.isActive);
  if (match) {
    const provider = await options.repos.providers.resolve(options.owner, match.id);
    if (provider?.apiKey) return provider.apiKey;
  }
  return options.env.providerKeys.gemini;
}

export async function resolveProvider(options: {
  repos: ReturnType<typeof createAuth>['repos'];
  env: ServerEnv;
  owner: string;
  input: ProviderInput;
}): Promise<ResolvedProvider> {
  const { repos, env, owner, input } = options;
  let provider: Awaited<ReturnType<typeof repos.providers.resolve>> = null;

  if (input.providerId) {
    provider = await repos.providers.resolve(owner, input.providerId);
    if (!provider) throw new HttpError(404, 'Provider not found', 'NOT_FOUND');
    if (!provider.isActive) throw new HttpError(400, 'Provider is disabled', 'PROVIDER_DISABLED');
    if (input.providerType && input.providerType !== provider.type) {
      throw new HttpError(400, 'Provider type does not match the configured provider', 'PROVIDER_MISMATCH');
    }
  } else if (input.providerType) {
    const providers = await repos.providers.list(owner);
    const match = providers.find((item) => item.type === input.providerType && item.isActive);
    provider = match ? await repos.providers.resolve(owner, match.id) : null;
  } else {
    throw new HttpError(400, 'Provider type or provider ID is required', 'PROVIDER_REQUIRED');
  }

  const type = provider?.type ?? input.providerType!;
  return {
    providerType: type,
    providerId: provider?.id,
    baseUrl: input.baseUrl ?? provider?.baseUrl ?? (type === 'ollama' ? env.ollamaBaseUrl : undefined),
    apiKey: input.apiKey ?? provider?.apiKey ?? environmentKey(env, type),
    customHeaders: input.customHeaders ?? provider?.customHeaders,
  };
}
