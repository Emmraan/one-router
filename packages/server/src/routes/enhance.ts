import { Hono } from 'hono';
import { enhancePrompt, isCoreError } from '@one-router/core';
import { z } from 'zod';
import type { ServerEnv } from '../env';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import { resolveGeminiKey } from '../providers/resolve';
import type { AppEnv } from '../types';

const schema = z.object({
  prompt: z.string().min(1).max(100000),
  apiKey: z.string().max(8192).optional(),
}).strict();

export function enhanceRoutes(deps: { env: ServerEnv; auth: ReturnType<typeof createAuth>; fetch?: typeof fetch }) {
  const app = new Hono<AppEnv>();

  app.post('/', async (c) => {
    const body = await readJson(c, schema, 256 * 1024);
    try {
      const apiKey = await resolveGeminiKey({
        repos: deps.auth.repos, env: deps.env, owner: c.get('ownerId'), apiKey: body.apiKey,
      });
      const enhanced = await enhancePrompt({
        prompt: body.prompt, apiKey, fetch: deps.fetch, signal: AbortSignal.timeout(15_000),
      });
      return c.json({ enhanced });
    } catch (error) {
      if (isCoreError(error) && error.code === 'INVALID_REQUEST') {
        return c.json({ error: error.message, code: error.code }, error.status as 400);
      }
      return c.json({ error: 'Enhancement failed', code: 'ENHANCE_FAILED' }, 500);
    }
  });

  return app;
}
