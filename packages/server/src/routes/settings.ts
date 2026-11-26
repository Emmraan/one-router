import { Hono } from 'hono';
import { z } from 'zod';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { repositoryFailure } from './errors';

const settingSchema = z.object({ value: z.unknown() }).strict();

export function settingRoutes(deps: { auth: ReturnType<typeof createAuth> }) {
  const app = new Hono<AppEnv>();
  const repos = deps.auth.repos;

  app.get('/', async (c) => c.json({ settings: await repos.settings.get(c.get('ownerId')) }));

  app.put('/:key', async (c) => {
    const body = await readJson(c, settingSchema, 128 * 1024);
    try {
      await repos.settings.set(c.get('ownerId'), c.req.param('key'), body.value);
      return c.json({ ok: true });
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.delete('/:key', async (c) => {
    try {
      await repos.settings.delete(c.get('ownerId'), c.req.param('key'));
      return c.json({ ok: true });
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  return app;
}
