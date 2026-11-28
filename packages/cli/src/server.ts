import { createServer } from 'node:http';
import { getRequestListener } from '@hono/node-server';
import { bootstrapDatabase, createApp, type ServerEnv } from '@one-router/server';
import { CliError } from './arguments';
import { reportBootstrap, serverLogger } from './logger';
import { webDir } from './paths';
import { installShutdown } from './shutdown';
import { createStaticHandler } from './static';

const apiOnlyGroups = new Set(['auth', 'chats', 'providers', 'settings', 'files', 'data']);
const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost']);
const isGroup = (path: string, group: string) => path === group || path.startsWith(`${group}/`);

async function bind(server: ReturnType<typeof createServer>, host: string, requested: number) {
  for (let port = requested; port <= 65535; port++) {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    server.once('error', reject);
    server.once('listening', resolve);
    try {
      server.listen(port, host);
      await promise;
      return port;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw new CliError('Could not bind the HTTP listener');
    } finally {
      server.off('error', reject);
      server.off('listening', resolve);
    }
  }
  throw new CliError(`No available port at or above ${requested}`);
}

export async function serveApplication(options: {
  env: ServerEnv; host: string; apiOnly: boolean; onReady: (port: number) => void;
}) {
  const { env, host, apiOnly, onReady } = options;
  const serveStatic = apiOnly ? undefined : await createStaticHandler(webDir, env.production).catch(() => {
    throw new CliError('The packaged web UI is missing or unreadable');
  });
  let api: ReturnType<typeof createApp> | undefined;
  const checkHost = loopbackHosts.has(host.toLowerCase()) || host === '::1';
  const proxyHosts = new Set(env.allowedOrigins.map((origin) => new URL(origin).host));
  const server = createServer(getRequestListener((request) => {
    const url = new URL(request.url);
    if (checkHost && !loopbackHosts.has(url.hostname) && !proxyHosts.has(url.host)) {
      return new Response(null, { status: 421, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!api) return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    const path = url.pathname;
    if (isGroup(path, '/api') || isGroup(path, '/v1') || path === '/health' || path === '/openapi.json') {
      if (!apiOnly || isGroup(path, '/v1') || path === '/health' ||
        (isGroup(path, '/api') && apiOnlyGroups.has(path.split('/')[2]))) return api.fetch(request);
    } else if (serveStatic) return serveStatic(request);
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }));

  const port = await bind(server, host, env.port);
  const shutdown = installShutdown(server);
  let db: Awaited<ReturnType<typeof bootstrapDatabase>>['db'] | undefined;
  try {
    const result = await bootstrapDatabase({ ...env, port }).catch(() => {
      throw new CliError('Could not start the database; check the data directory, encryption key and database settings');
    });
    db = result.db;
    reportBootstrap(result.seeded, env.dataDir, Boolean(env.initialPassword));
    if (!shutdown.isClosing()) {
      api = createApp({ db, env: { ...env, port }, logger: serverLogger });
      onReady(port);
    }
    await shutdown.stopped;
  } finally {
    await shutdown.close();
    shutdown.dispose();
    db?.close();
  }
}
