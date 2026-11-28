// Runs the same browser suite against an installed CLI or the production Docker image.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';

const docker = process.argv[2] === '--docker';
const image = docker ? process.argv[3] : undefined;
if (docker && (!image || process.platform !== 'linux')) throw new Error('Docker browser verification requires an image and Linux host networking');
const entry = docker ? undefined : resolve(process.argv[2] ?? 'packages/cli/dist/index.js');
const require = createRequire(resolve('apps/web/package.json'));
const playwright = require.resolve('@playwright/test/cli');
const port = 3100;
const providerPort = 4100;
const origin = `http://localhost:${port}`;
const directory = await mkdtemp(join(tmpdir(), 'onerouter-browser-'));
const dataDir = join(directory, 'data');
const container = basename(directory);
const children = [];
const exits = [];

function start(command, args, env) {
  const child = spawn(command, args, {
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
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
    if (children.some((child) => child.exitCode !== null || child.signalCode !== null)) {
      throw new Error('A browser fixture process exited before readiness');
    }
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
      windowsHide: true,
    });
    child.on('error', rejectRun);
    child.on('close', (code) => code === 0 ? resolveRun() : rejectRun(new Error(`${command} exited with ${code}`)));
  });
}

try {
  start(process.execPath, [resolve('scripts/e2e-provider-stub.mjs')], { PORT: String(providerPort) });
  if (docker) {
    await mkdir(dataDir);
    // The production container runs as UID 1000; only this disposable fixture is writable.
    await chmod(dataDir, 0o777);
    start('docker', ['run', '--rm', '--name', container, '--network', 'host',
      '--mount', `type=bind,source=${dataDir},target=/data`,
      '--env', 'INITIAL_PASSWORD=correct horse battery staple',
      '--env', `ONE_ROUTER_ALLOWED_ORIGINS=${origin}`,
      image, 'one-router', 'serve', '--no-open', '--port', String(port)], {});
  } else {
    start(process.execPath, [entry, 'serve', '--no-open', '--port', String(port)], {
      NODE_ENV: 'test',
      ONE_ROUTER_DATA_DIR: dataDir,
      ONE_ROUTER_CONFIG: join(directory, 'config.json'),
      INITIAL_PASSWORD: 'correct horse battery staple',
      ONE_ROUTER_ALLOWED_ORIGINS: origin,
    });
  }
  await ready(`${origin}/health`, async (response) => (await response.json()).database === 'ok');
  await ready(`http://localhost:${providerPort}/api/tags`);
  await run(process.execPath, [playwright, 'test'], {
    E2E_EXTERNAL: '1',
    E2E_BASE_URL: origin,
    E2E_PROVIDER_TYPE: 'ollama',
    E2E_PROVIDER_BASE_URL: `http://localhost:${providerPort}`,
    E2E_STATS_DB: join(dataDir, 'one-router.db'),
  });
  console.log(`${docker ? 'Docker image' : 'Packed CLI'} browser suite passed.`);
} catch (error) {
  if (process.env.CI) console.error(`::error::${error instanceof Error ? error.message : 'Packed browser suite failed'}`);
  throw error;
} finally {
  try {
    if (docker) {
      await run('docker', ['rm', '--force', container]).catch(() => undefined);
      // The image UID owns private attachment directories that the host runner cannot traverse.
      await run('docker', ['run', '--rm', '--mount', `type=bind,source=${dataDir},target=/data`,
        '--entrypoint', 'node', image, '-e',
        'const fs = require("node:fs"); for (const name of fs.readdirSync("/data")) fs.rmSync("/data/" + name, { recursive: true, force: true });']);
    }
  } finally {
    for (const child of children) child.kill();
    await Promise.all(exits);
    await rm(directory, { recursive: true, force: true });
  }
}
