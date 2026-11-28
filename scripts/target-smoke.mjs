import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = resolve(process.argv[2] ?? 'node_modules/onerouter/dist/index.js');
const suite = fileURLToPath(new URL('./deployment-smoke.mjs', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'onerouter-target-'));
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'production',
  ONE_ROUTER_DATA_DIR: join(directory, 'data'), ONE_ROUTER_CONFIG: join(directory, 'config.json'),
  INITIAL_PASSWORD: 'Target smoke bootstrap!47', OWNER_PASSWORD: 'Target smoke owner!53' };
let server;
let closed;

async function run(file, args) {
  const child = spawn(process.execPath, [file, ...args], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  const [code] = await once(child, 'close');
  assert.equal(code, 0, 'Deployment target operation failed (credentials and response bodies are not logged)');
  return output.trim();
}

async function start(port) {
  server = spawn(process.execPath, [entry, 'serve', '--no-open', '--port', String(port)], {
    env, windowsHide: true, stdio: 'ignore',
  });
  closed = once(server, 'close');
  // Observe spawn errors immediately, even while the HTTP suite waits for readiness.
  closed.catch(() => undefined);
}

try {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  await start(port);
  const id = await run(suite, ['fresh', origin]);
  server.kill();
  await closed;
  await start(port);
  await run(suite, ['persist', origin, id]);
  const recoveryFixture = await run(suite, ['backup-seed', origin]);
  server.kill();
  await closed;
  const backup = join(directory, 'backup');
  // Copy only after shutdown so the database, WAL, attachments, and encryption key agree.
  await cp(env.ONE_ROUTER_DATA_DIR, backup, { recursive: true });
  env.ONE_ROUTER_DATA_DIR = join(directory, 'restored');
  env.ONE_ROUTER_CONFIG = join(directory, 'restored-config.json');
  await cp(backup, env.ONE_ROUTER_DATA_DIR, { recursive: true });
  await start(port);
  await run(suite, ['backup-restore', origin, id, recoveryFixture]);
  console.log('Shared target suite passed: auth, headers, chat/message persistence, upload, encrypted export/import, restart, full data-directory recovery.');
} finally {
  if (server && closed) {
    server.kill();
    await closed.catch(() => undefined);
  }
  await rm(directory, { recursive: true, force: true });
}
