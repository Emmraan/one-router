import { Hono } from 'hono';
import { providerTypeSchema } from '@one-router/core';
import { z } from 'zod';
import { HttpError } from '../errors';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { repositoryFailure } from './errors';

const fields = {
  name: z.string().min(1).max(200),
  type: providerTypeSchema,
  baseUrl: z.string().min(1).max(2048),
  apiKey: z.string().max(8192).optional(),
  customHeaders: z.union([
    z.string().max(16384),
    z.record(z.string().max(200), z.string().max(8192)),
  ]).optional(),
  models: z.array(z.string().min(1).max(500)).max(1000).optional(),
  isActive: z.boolean().optional(),
};
const createSchema = z.object({ id: z.string().min(1).max(200).optional(), ...fields }).strict();
const patchSchema = z.object(fields).partial().strict();

export function providerRoutes(deps: { auth: ReturnType<typeof createAuth> }) {
  const app = new Hono<AppEnv>();
  const repos = deps.auth.repos;

  app.get('/', async (c) => c.json({ providers: await repos.providers.list(c.get('ownerId')) }));

  app.post('/', async (c) => {
    const body = await readJson(c, createSchema, 64 * 1024);
    try {
      const provider = await repos.providers.create(c.get('ownerId'), body);
      return c.json({ provider }, 201);
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.get('/:id', async (c) => {
    const provider = await repos.providers.get(c.get('ownerId'), c.req.param('id'));
    if (!provider) throw new HttpError(404, 'Provider not found', 'NOT_FOUND');
    return c.json({ provider });
  });

  app.patch('/:id', async (c) => {
    const body = await readJson(c, patchSchema, 64 * 1024);
    if (Object.keys(body).length === 0) throw new HttpError(400, 'No changes supplied', 'INVALID_REQUEST');
    try {
      const provider = await repos.providers.update(c.get('ownerId'), c.req.param('id'), body);
      if (!provider) throw new HttpError(404, 'Provider not found', 'NOT_FOUND');
      return c.json({ provider });
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.delete('/:id', async (c) => {
    await repos.providers.delete(c.get('ownerId'), c.req.param('id'));
    return c.json({ ok: true });
  });

  return app;
}
