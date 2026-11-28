// Runs the browser suite against the packaged CLI and a local provider stub.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const entry = resolve(process.argv[2] ?? 'packages/cli/dist/index.js');
const port = 3100;
const providerPort = 4100;
const origin = `http://localhost:${port}`;
const directory = await mkdtemp(join(tmpdir(), 'onerouter-browser-'));
const dataDir = join(directory, 'data');
const children = [];
const exits = [];

function start(file, args, env) {
  const child = spawn(process.execPath, [file, ...args], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });
  children.push(child);
  exits.push(once(child, 'close').catch(() => undefined));
  child.on('error', (error) => console.error(error.message));
  return child;
}

async function ready(url, check) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok && (!check || (await check(response)))) return;
    } catch {
      // The process may still be binding its port.
    }
    await setTimeout(500);
  }
  throw new Error(`No ready response from ${url}`);
}

function run(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: resolve('apps/web'),
      env: { ...process.env, ...env },
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    child.on('error', rejectRun);
    child.on('close', (code) => code === 0 ? resolveRun() : rejectRun(new Error(`Playwright exited with ${code}`)));
  });
}

try {
  start(resolve('scripts/e2e-provider-stub.mjs'), [], { PORT: String(providerPort) });
  start(entry, ['serve', '--no-open', '--port', String(port)], {
    NODE_ENV: 'test',
    ONE_ROUTER_DATA_DIR: dataDir,
    ONE_ROUTER_CONFIG: join(directory, 'config.json'),
    INITIAL_PASSWORD: 'correct horse battery staple',
    ONE_ROUTER_ALLOWED_ORIGINS: origin,
  });
  await ready(`${origin}/health`, async (response) => (await response.json()).database === 'ok');
  await ready(`http://localhost:${providerPort}/api/tags`);
  await run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['exec', 'playwright', 'test'], {
    E2E_EXTERNAL: '1',
    E2E_BASE_URL: origin,
    E2E_PROVIDER_TYPE: 'ollama',
    E2E_PROVIDER_BASE_URL: `http://localhost:${providerPort}`,
    E2E_STATS_DB: join(dataDir, 'one-router.db'),
  });
  console.log('Packed CLI browser suite passed.');
} catch (error) {
  if (process.env.CI) console.error(`::error::${error instanceof Error ? error.message : 'Packed browser suite failed'}`);
  throw error;
} finally {
  for (const child of children) child.kill();
  await Promise.all(exits);
  await rm(directory, { recursive: true, force: true });
}
