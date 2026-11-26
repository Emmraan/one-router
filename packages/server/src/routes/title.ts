import { Hono } from 'hono';
import { deriveTitle, generateTitle, normalizeTitle } from '@one-router/core';
import { z } from 'zod';
import type { ServerEnv } from '../env';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import { resolveGeminiKey, resolveProvider } from '../providers/resolve';
import { runTextTask } from '../providers/text-task';
import type { AppEnv } from '../types';

const schema = z.object({
  message: z.string().max(100000),
  apiKey: z.string().max(8192).optional(),
  providerId: z.string().min(1).max(200).optional(),
  model: z.string().min(1).max(500).optional(),
}).strict();

export function titleRoutes(deps: { env: ServerEnv; auth: ReturnType<typeof createAuth>; fetch?: typeof fetch }) {
  const app = new Hono<AppEnv>();

  app.post('/', async (c) => {
    const body = await readJson(c, schema, 256 * 1024);
    const message = body.message.trim();
    if (!message) return c.json({ title: 'New Chat' });
    const fallback = deriveTitle(message);

    if (body.providerId && body.model) {
      try {
        const provider = await resolveProvider({
          repos: deps.auth.repos,
          env: deps.env,
          owner: c.get('ownerId'),
          input: { providerId: body.providerId },
        });
        const text = await runTextTask({
          provider,
          model: body.model,
          input: message,
          fetch: deps.fetch,
          signal: AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(15_000)]),
          maxOutput: 500,
          instruction:
            'Generate a short chat title of 3 to 6 words in the same language as the user message. Return only the title text, with no quotation marks, prefix, greeting, or punctuation.',
        });
        const title = normalizeTitle(text);
        return c.json({ title: title === 'New Chat' ? fallback : title });
      } catch {
        return c.json({ title: fallback });
      }
    }

    try {
      const apiKey = await resolveGeminiKey({
        repos: deps.auth.repos,
        env: deps.env,
        owner: c.get('ownerId'),
        apiKey: body.apiKey,
      });
      const title = await generateTitle({
        message,
        apiKey,
        fetch: deps.fetch,
        signal: AbortSignal.timeout(15_000),
      });
      return c.json({ title });
    } catch {
      return c.json({ title: fallback });
    }
  });

  return app;
}
