import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export function percentile(samples, rank) {
  if (!samples.length || samples.some((value) => !Number.isFinite(value) || value < 0) ||
      !Number.isFinite(rank) || rank <= 0 || rank > 1) throw new Error('Invalid percentile input');
  return [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * rank) - 1];
}

export function parseRss(output, platform) {
  const raw = platform === 'win32' ? output.match(/,"([\d,.\s]+) K"/i)?.[1]?.replace(/[,\.\s]/g, '') : output.trim();
  if (!raw || !/^\d+$/.test(raw) || Number(raw) <= 0) throw new Error('Could not measure process RSS');
  return Number(raw) * 1024;
}

export function evaluateRuntimeBudget({ rssBytes, p95Ms }) {
  const checks = [
    { label: 'Idle RSS (bytes)', actual: rssBytes, limit: 150 * 1024 * 1024, strict: true },
    { label: 'Warm API p95 (ms)', actual: p95Ms, limit: 200, strict: false },
  ].map((check) => ({ ...check, ok: Number.isFinite(check.actual) && check.actual > 0 &&
    (check.strict ? check.actual < check.limit : check.actual <= check.limit) }));
  return { ok: checks.every((check) => check.ok), checks };
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

export async function measureRuntime(entry = resolve('packages/cli/dist/index.js')) {
  const directory = await mkdtemp(join(tmpdir(), 'onerouter-budget-'));
  let child;
  let closed;
  try {
    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;
    const password = 'Runtime budget bootstrap!47';
    const started = performance.now();
    child = spawn(process.execPath, [entry, 'serve', '--api-only', '--no-open', '--port', String(port)], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'production',
        ONE_ROUTER_DATA_DIR: directory, ONE_ROUTER_CONFIG: join(directory, 'config.json'), INITIAL_PASSWORD: password },
      stdio: 'ignore', windowsHide: true,
    });
    let failed = false;
    child.on('error', () => { failed = true; });
    closed = new Promise((resolve) => child.once('close', resolve));
    const request = (path, body, cookie) => fetch(`${origin}${path}`, {
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(5000), redirect: 'manual',
      headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    while (true) {
      if (failed || child.exitCode !== null || performance.now() - started > 15000) throw new Error('Budget server did not become ready');
      const response = await request('/health').catch(() => undefined);
      const ready = response?.ok && (await response.json()).database === 'ok';
      if (!ready) await response?.body?.cancel();
      if (ready) break;
      await setTimeout(20);
    }
    const startupMs = performance.now() - started;
    const login = await request('/api/auth/login', { password });
    assert.equal(login.status, 200, 'Budget login failed');
    const bootstrapCookie = login.headers.getSetCookie()[0]?.split(';')[0];
    await login.body?.cancel();
    assert.ok(bootstrapCookie, 'Missing budget session');
    const ownerPassword = 'Runtime budget owner!53';
    const changed = await request('/api/auth/password', {
      currentPassword: password, newPassword: ownerPassword, confirmation: ownerPassword,
    }, bootstrapCookie);
    assert.equal(changed.status, 200, 'Budget password change failed');
    const cookie = changed.headers.getSetCookie()[0]?.split(';')[0];
    await changed.body?.cancel();
    assert.ok(cookie, 'Missing owner session');
    const samples = [];
    for (let i = 0; i < 60; i++) {
      const before = performance.now();
      const response = await request('/api/chats?limit=1', undefined, cookie);
      assert.equal(response.status, 200, 'Budget request failed');
      await response.arrayBuffer();
      if (i >= 10) samples.push(performance.now() - before);
    }
    await setTimeout(500);
    const command = process.platform === 'win32' ? 'tasklist' : 'ps';
    const args = process.platform === 'win32' ? ['/FI', `PID eq ${child.pid}`, '/FO', 'CSV', '/NH'] : ['-o', 'rss=', '-p', String(child.pid)];
    const rssBytes = parseRss(execFileSync(command, args, { encoding: 'utf8', timeout: 10000 }), process.platform);
    return { startupMs, rssBytes, p95Ms: percentile(samples, 0.95) };
  } finally {
    if (child && closed) {
      child.kill();
      await closed;
    }
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const measured = await measureRuntime(process.argv[2]);
    const result = evaluateRuntimeBudget(measured);
    for (const check of result.checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label}: ${check.actual.toFixed(1)} / ${check.limit}`);
    console.log(`Local bootstrap: ${measured.startupMs.toFixed(1)} ms (diagnostic, not the Vercel cold-start budget).`);
    console.log('Fresh local database; 10 warmups, 50 authenticated requests. Vercel cold start requires separate preview evidence.');
    if (!result.ok) process.exitCode = 1;
  } catch {
    console.error('Runtime budget failed; build the CLI and verify local process measurement tools are available.');
    process.exitCode = 1;
  }
}
