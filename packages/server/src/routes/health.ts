import { Hono } from 'hono';
import type { Database } from '@one-router/db';
import type { ServerEnv } from '../env';
import type { AppEnv } from '../types';

export function healthRoutes(db: Database, env: ServerEnv) {
  const app = new Hono<AppEnv>();
  app.get('/health', async (c) => {
    try {
      await db.client.execute('SELECT 1');
      return c.json({ status: 'ok', version: env.version, database: 'ok' });
    } catch {
      return c.json({ status: 'error', version: env.version, database: 'unavailable' }, 503);
    }
  });
  return app;
}
