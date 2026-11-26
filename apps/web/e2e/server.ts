// Boots a real Hono server for the browser E2E run. The provider HTTP call is a
// local stub so the suite never touches the network; everything else (auth,
// SQLite, streaming) is the shipped code path.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import type { FetchLike } from '@one-router/core';
import { bootstrapDatabase, createApp, loadEnv } from '@one-router/server';

type Database = Awaited<ReturnType<typeof bootstrapDatabase>>['db'];

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

// Only the E2E server knows this route; it reads the real SQLite file so a test
// can prove that a temporary chat never reached the database.
async function databaseStats(db: Database) {
  const result = await db.client.execute(
    'select (select count(*) from chats) as chats, (select count(*) from messages) as messages, (select count(*) from attachments) as attachments',
  );
  const row = result.rows[0] ?? {};
  return {
    chats: Number(row.chats ?? 0),
    messages: Number(row.messages ?? 0),
    attachments: Number(row.attachments ?? 0),
  };
}

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
  serve(
    {
      port: E2E_PORT,
      fetch: async (request, ...rest) => {
        if (new URL(request.url).pathname === '/health/__e2e/stats') {
          return Response.json(await databaseStats(db));
        }
        return app.fetch(request, ...rest);
      },
    },
    (info) => {
      console.log(`E2E API on http://localhost:${info.port} (data ${dataDir})`);
    },
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
