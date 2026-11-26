import { Hono } from 'hono';
import { discoverModels, providerTypeSchema, type FetchLike } from '@one-router/core';
import { z } from 'zod';
import type { ServerEnv } from '../env';
import { redactSecrets } from '../errors';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import { resolveProvider } from '../providers/resolve';
import type { AppEnv } from '../types';

const schema = z.object({
  providerId: z.string().min(1).max(200).optional(),
  providerType: providerTypeSchema.optional(),
  baseUrl: z.string().max(2048).optional(),
  apiKey: z.string().max(8192).optional(),
}).strict();

function publicError(error: unknown): string {
  const message = typeof error === 'string'
    ? error
    : error instanceof Error ? error.message : 'Discovery connection error';
  return redactSecrets(message).slice(0, 300);
}

export function discoveryRoutes(deps: {
  env: ServerEnv;
  auth: ReturnType<typeof createAuth>;
  fetch?: FetchLike;
}) {
  const app = new Hono<AppEnv>();

  app.post('/', async (c) => {
    const body = await readJson(c, schema, 64 * 1024);
    try {
      const resolved = await resolveProvider({
        repos: deps.auth.repos, env: deps.env, owner: c.get('ownerId'), input: body,
      });
      const result = await discoverModels({
        providerType: resolved.providerType,
        baseUrl: resolved.baseUrl,
        apiKey: resolved.apiKey,
      }, { fetch: deps.fetch, signal: AbortSignal.timeout(15_000) });
      return c.json(result.success ? result : { success: false, error: publicError(result.error) });
    } catch (error) {
      return c.json({ success: false, error: publicError(error) });
    }
  });

  return app;
}
