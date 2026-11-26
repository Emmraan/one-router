import { Hono } from 'hono';
import { enhancePrompt, isCoreError } from '@one-router/core';
import { z } from 'zod';
import type { ServerEnv } from '../env';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import { resolveGeminiKey } from '../providers/resolve';
import { resolveProvider } from '../providers/resolve';
import { runTextTask } from '../providers/text-task';
import { HttpError } from '../errors';
import type { AppEnv } from '../types';

const schema = z.object({
  prompt: z.string().trim().min(1).max(100000),
  apiKey: z.string().max(8192).optional(),
  providerId: z.string().min(1).max(200).optional(),
  model: z.string().min(1).max(500).optional(),
}).strict();

export function enhanceRoutes(deps: { env: ServerEnv; auth: ReturnType<typeof createAuth>; fetch?: typeof fetch }) {
  const app = new Hono<AppEnv>();

  app.post('/', async (c) => {
    const body = await readJson(c, schema, 256 * 1024);
    try {
      if (body.providerId && body.model) {
        const provider = await resolveProvider({ repos: deps.auth.repos, env: deps.env, owner: c.get('ownerId'), input: { providerId: body.providerId } });
        const enhanced = await runTextTask({ provider, model: body.model, input: body.prompt, fetch: deps.fetch,
          signal: AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(15_000)]), maxOutput: 100000,
          instruction: 'Rewrite the user prompt for clarity and useful structure. Preserve its intent, constraints, language, and formatting. Do not answer the prompt or add requirements. Return only the revised prompt.' });
        return c.json({ enhanced });
      }
      const apiKey = await resolveGeminiKey({
        repos: deps.auth.repos, env: deps.env, owner: c.get('ownerId'), apiKey: body.apiKey,
      });
      if (!apiKey) throw new HttpError(400, 'Select a provider and model before enhancing', 'PROVIDER_REQUIRED');
      const enhanced = await enhancePrompt({
        prompt: body.prompt, apiKey, fetch: deps.fetch, signal: AbortSignal.timeout(15_000),
      });
      return c.json({ enhanced });
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) return c.json({ error: 'Select an available provider and model', code: 'PROVIDER_REQUIRED' }, 400);
      if (isCoreError(error) && (error.code === 'INVALID_REQUEST' || error.code === 'PROVIDER_REQUIRED')) {
        return c.json({ error: error.message, code: error.code }, error.status as 400);
      }
      return c.json({ error: 'Enhancement failed', code: 'ENHANCE_FAILED' }, 500);
    }
  });

  return app;
}
