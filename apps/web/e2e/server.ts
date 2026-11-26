// Boots a real Hono server for the browser E2E run. The provider HTTP call is a
// local stub so the suite never touches the network; everything else (auth,
// SQLite, streaming) is the shipped code path.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import type { FetchLike } from '@one-router/core';
import { bootstrapDatabase, createApp, loadEnv } from '@one-router/server';

const E2E_PORT = 4000;
const E2E_ORIGIN = 'http://localhost:3100';

const fixtureFetch: FetchLike = async (input) => {
  const url = String(input);
  if (url.includes('/chat/completions')) {
    const body = [
      'data: {"choices":[{"delta":{"content":"Fixture "}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"reply."}}]}',
      '',
      'data: [DONE]',
      '',
      '',
    ].join('\n');
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }
  if (url.includes('/models')) {
    return new Response(JSON.stringify({ data: [{ id: 'fixture-model' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response('fixture: unknown request', { status: 404 });
};

async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), 'one-router-e2e-'));
  const env = loadEnv({
    NODE_ENV: 'test',
    ONE_ROUTER_DATA_DIR: dataDir,
    INITIAL_PASSWORD: 'correct horse battery staple',
    ONE_ROUTER_ALLOWED_ORIGINS: E2E_ORIGIN,
    PORT: String(E2E_PORT),
  });
  const { db } = await bootstrapDatabase(env);
  const app = createApp({ db, env, fetch: fixtureFetch });
  serve({ fetch: app.fetch, port: E2E_PORT }, (info) => {
    console.log(`E2E API on http://localhost:${info.port} (data ${dataDir})`);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
