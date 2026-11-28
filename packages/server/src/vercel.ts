import { createApp } from './app';
import { bootstrapDatabase } from './bootstrap';
import { loadVercelEnv } from './env';

async function start() {
  const env = loadVercelEnv();
  const { db } = await bootstrapDatabase(env, { requireInitialPassword: true });
  return createApp({ db, env });
}

let startup: Promise<Awaited<ReturnType<typeof start>> | undefined> | undefined;

export async function vercelFetch(request: Request): Promise<Response> {
  startup ??= start().catch(() => {
    startup = undefined;
    console.error('ONE ROUTER startup failed; check Turso, encryption key and first-owner settings.');
    return undefined;
  });
  const app = await startup;
  if (app) return app.fetch(request);
  return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Service unavailable' } }, {
    status: 503, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
