import { Hono } from 'hono';
import { generateTitle } from '@one-router/core';
import { z } from 'zod';
import type { ServerEnv } from '../env';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import { resolveGeminiKey } from '../providers/resolve';
import type { AppEnv } from '../types';

const schema = z.object({
  message: z.string().max(100000),
  apiKey: z.string().max(8192).optional(),
}).strict();

export function titleRoutes(deps: { env: ServerEnv; auth: ReturnType<typeof createAuth>; fetch?: typeof fetch }) {
  const app = new Hono<AppEnv>();

  app.post('/', async (c) => {
    try {
      const body = await readJson(c, schema, 256 * 1024);
      const apiKey = await resolveGeminiKey({
        repos: deps.auth.repos, env: deps.env, owner: c.get('ownerId'), apiKey: body.apiKey,
      });
      const title = await generateTitle({
        message: body.message, apiKey, fetch: deps.fetch, signal: AbortSignal.timeout(15_000),
      });
      return c.json({ title });
    } catch {
      return c.json({ title: 'New Chat' });
    }
  });

  return app;
}
