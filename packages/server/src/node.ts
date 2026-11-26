import { pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { bootstrapDatabase } from './bootstrap';
import { loadEnv, type ServerEnv } from './env';

export async function startServer(env: ServerEnv = loadEnv()) {
  const { db, seeded } = await bootstrapDatabase(env);
  const app = createApp({ db, env });
  const server = serve({ fetch: app.fetch, port: env.port });
  if (seeded.created) {
    if (!env.initialPassword && seeded.password) {
      console.log(`Bootstrap owner password: ${seeded.password}`);
      console.log('Store this password now. It is printed once and must be changed after login.');
    } else {
      console.log('Bootstrap owner created with INITIAL_PASSWORD.');
    }
  }
  return { server, db, app };
}

function isMain(): boolean {
  return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  startServer().catch((error: unknown) => {
    console.error('Server failed to start:', error instanceof Error ? error.message : 'unknown error');
    process.exit(1);
  });
}
