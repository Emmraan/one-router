import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const installed = join(process.cwd(), 'node_modules', 'onerouter');
const entry = join(installed, 'dist', 'index.js');
const version = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8')).version;
const directory = await mkdtemp(join(tmpdir(), 'onerouter-smoke-'));
const data = join(directory, 'local state');
const config = join(directory, 'config.json');
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: 'development',
  ONE_ROUTER_DATA_DIR: data, ONE_ROUTER_CONFIG: config };
const processes = new Set();

function cli(args, extraEnv = {}) {
  const child = spawn(process.execPath, [entry, ...args], {
    env: { ...env, ...extraEnv }, signal: AbortSignal.timeout(60000), windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  child.stdin.on('error', () => {});
  processes.add(child);
  const closed = new Promise((resolve) => {
    let failed = false;
    child.on('error', () => { failed = true; });
    child.once('close', (code) => {
      processes.delete(child);
      resolve({ code, failed, stdout, stderr });
    });
  });
  return { child, closed, stop: async () => { child.kill(); return closed; } };
}

async function run(args, { input, ...extraEnv } = {}) {
  const command = cli(args, extraEnv);
  command.child.stdin.end(input);
  const result = await command.closed;
  assert.equal(result.failed, false, `Could not run ${args.join(' ')}`);
  assert.equal(result.code, 0, `${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

async function start(args, extraEnv) {
  const command = cli(['serve', '--no-open', ...args], extraEnv);
  command.child.stdin.end();
  let stdout = '';
  const ready = new Promise((resolve) => {
    command.child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const address = stdout.match(/ONE ROUTER listening at (http:\/\/127\.0\.0\.1:\d+)[^\r\n]*\r?\n/);
      if (address) resolve(address[1]);
    });
  });
  const url = await Promise.race([ready, command.closed.then(({ stderr }) => {
    throw new Error(`CLI exited before readiness: ${stderr.trim()}`);
  })]);
  return { ...command, url, stdout };
}

function request(origin, path, { body, cookie, ...options } = {}) {
  return fetch(`${origin}${path}`, { signal: AbortSignal.timeout(15000), ...options,
    headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) }).catch((error) => {
    throw new Error(`Request to ${path} failed`, { cause: error });
  });
}

async function login(url, password, mustChange) {
  const response = await request(url, '/api/auth/login', { body: { password } });
  assert.equal(response.status, 200, 'Owner login failed');
  assert.equal((await response.json()).mustChangePassword, mustChange);
  const cookie = response.headers.getSetCookie()[0]?.split(';')[0];
  assert.ok(cookie, 'Login must issue a session cookie');
  return cookie;
}

async function stop(command) {
  const { code, failed } = await command.stop();
  assert.equal(failed, false, 'CLI did not stop before the deadline');
  if (process.platform !== 'win32') assert.equal(code, 0, 'Signal should trigger a graceful shutdown');
}

const blocker = createServer();
try {
  assert.equal(await run(['--version']), version);
  assert.match(await run(['--help']), /Usage: one-router/);
  assert.equal(await run(['config', '--path']), config);
  const fixtureSecret = 'config-test-only-secret';
  await writeFile(config, JSON.stringify({ OPENAI_API_KEY: fixtureSecret, PORT: 3000 }), { mode: 0o600 });
  const printed = await run(['config', '--print']);
  assert.ok(!printed.includes(fixtureSecret), 'Config printed an API key');
  assert.equal(JSON.parse(printed).OPENAI_API_KEY, '[redacted]');

  const listening = once(blocker, 'listening');
  blocker.listen({ host: '127.0.0.1', port: 0 });
  await listening;
  const occupied = blocker.address().port;
  const app = await start(['--port', String(occupied)]);
  assert.ok(Number(new URL(app.url).port) > occupied, 'CLI did not fall back to the next port');
  assert.match(app.stdout, /Data directory: /);
  const bootstrap = app.stdout.match(/Bootstrap owner password \(sensitive\): ([^\r\n]+)/)?.[1];
  assert.ok(bootstrap, 'Missing generated bootstrap password');
  assert.deepEqual(await (await request(app.url, '/health')).json(), { status: 'ok', version, database: 'ok' });
  for (const path of ['/', '/login/', '/change-password/']) {
    const response = await request(app.url, path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /script-src 'self' 'sha256-/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const html = await response.text();
    const script = html.match(/src="(\/_next\/static\/[^" ]+\.js)"/)?.[1];
    assert.ok(script, 'Packaged page must load a web chunk');
    const chunk = await request(app.url, script, { method: 'HEAD' });
    assert.equal(chunk.status, 200);
    assert.match(chunk.headers.get('cache-control'), /immutable/);
  }
  const initial = await login(app.url, bootstrap, true);
  assert.equal((await request(app.url, '/api/chats', { cookie: initial })).status, 403);
  assert.equal((await request(app.url, '/v1/models')).status, 401);
  const owner = 'SmokeOwner-changed!47';
  assert.equal((await request(app.url, '/api/auth/password', { cookie: initial,
    body: { currentPassword: bootstrap, newPassword: owner, confirmation: owner } })).status, 200);
  const session = await login(app.url, owner, false);
  assert.equal((await request(app.url, '/api/chats', { cookie: session })).status, 200);
  const reset = 'SmokeOwner-reset!53';
  assert.match(await run(['user', 'reset-password', '--stdin'], { input: `${reset}\n` }), /Existing sessions were revoked/);
  assert.equal((await (await request(app.url, '/api/auth/status', { cookie: session })).json()).authenticated, false);
  await stop(app);

  const silent = await start(['--api-only', '--port', String(Number(new URL(app.url).port))]);
  assert.ok(!silent.stdout.includes('Bootstrap owner password'), 'Restart printed a bootstrap password');
  assert.equal((await request(silent.url, '/')).status, 404);
  assert.equal((await request(silent.url, '/api/chat', { body: {} })).status, 404);
  assert.equal((await request(silent.url, '/v1/models')).status, 401);
  await login(silent.url, reset, true);
  await stop(silent);

  const initialPassword = 'SmokeOwner-supplied!61';
  const initEnv = { ONE_ROUTER_DATA_DIR: join(directory, 'initialized'), INITIAL_PASSWORD: initialPassword };
  const initialized = await run(['init'], initEnv);
  assert.ok(!initialized.includes(initialPassword), 'Init printed the supplied password');
  assert.match(await run(['init'], initEnv), /password is unchanged/);
  const headless = await start(['--api-only', '--port', String(occupied)], initEnv);
  await login(headless.url, initialPassword, true);
  await stop(headless);
  console.log(`Verified the installed onerouter ${version}: UI, health, owner setup, login, password change and reset.`);
} finally {
  blocker.close();
  await Promise.all([...processes].map(async (child) => {
    const result = new Promise((resolve) => child.once('close', resolve));
    child.kill();
    await result;
  }));
  await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
