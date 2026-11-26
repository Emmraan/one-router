import { PROVIDER_TYPES, parseModelRef, resolveModelAlias, type ModelAlias, type ProviderType } from '@one-router/core';
import { HttpError } from '../errors';
import type { createAuth } from '../middleware/auth';

export async function loadAliases(repos: ReturnType<typeof createAuth>['repos'], owner: string): Promise<ModelAlias[]> {
  const settings = await repos.settings.get(owner);
  const raw = settings.modelAliases;
  if (!Array.isArray(raw)) return [];
  const aliases: ModelAlias[] = [];
  for (const entry of raw.slice(0, 100)) {
    if (!entry || typeof entry !== 'object') continue;
    const { alias, target } = entry as { alias?: unknown; target?: unknown };
    if (typeof alias !== 'string' || typeof target !== 'string') continue;
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(alias) || !parseModelRef(target)) continue;
    aliases.push({ alias, target });
  }
  return aliases;
}

export interface ResolvedModel {
  providerId: string;
  providerType: ProviderType;
  model: string;
  requested: string;
}

export async function resolveV1Model(options: {
  repos: ReturnType<typeof createAuth>['repos'];
  owner: string;
  model: string;
}): Promise<ResolvedModel> {
  const aliases = await loadAliases(options.repos, options.owner);
  const target = resolveModelAlias(options.model, aliases);
  const ref = parseModelRef(target);
  if (!ref) throw new HttpError(400, 'Model must be provider/model or a configured alias', 'MODEL_NOT_FOUND');

  let provider = await options.repos.providers.resolve(options.owner, ref.provider);
  if (!provider) {
    const providers = await options.repos.providers.list(options.owner);
    const match = providers.find((item) => item.type === ref.provider || item.name === ref.provider);
    if (match) provider = await options.repos.providers.resolve(options.owner, match.id);
    else if ((PROVIDER_TYPES as readonly string[]).includes(ref.provider)) {
      const byType = providers.find((item) => item.type === ref.provider && item.isActive);
      if (byType) provider = await options.repos.providers.resolve(options.owner, byType.id);
    }
  }
  if (!provider) throw new HttpError(404, `No configured provider for ${ref.provider}`, 'MODEL_NOT_FOUND');
  if (!provider.isActive) throw new HttpError(400, 'Provider is disabled', 'PROVIDER_DISABLED');
  return { providerId: provider.id, providerType: provider.type, model: ref.model, requested: options.model };
}
