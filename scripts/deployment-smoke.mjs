import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

const [mode, address, chatId] = process.argv.slice(2);
const url = new URL(address);
const { INITIAL_PASSWORD, OWNER_PASSWORD, VERCEL_AUTOMATION_BYPASS_SECRET } = process.env;
const message = 'Deployment smoke: encrypted message';
const attachment = 'Deployment smoke: encrypted attachment';

function request(path, { cookie, body, method, origin = url.origin } = {}) {
  const target = new URL(path, url);
  assert.equal(target.origin, url.origin, 'Smoke requests must stay on the deployment origin');
  return fetch(target, {
    method: method ?? (body ? 'POST' : 'GET'),
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(VERCEL_AUTOMATION_BYPASS_SECRET ? { 'x-vercel-protection-bypass': VERCEL_AUTOMATION_BYPASS_SECRET } : {}),
    },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

async function expectResponse(path, status, options) {
  const response = await request(path, options);
  assert.equal(response.status, status, `${path} returned the wrong status`);
  return response;
}

async function ready() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await request('/health').catch(() => undefined);
    if (response?.ok && (await response.json()).database === 'ok') return;
    await response?.body?.cancel();
    await setTimeout(1000);
  }
  throw new Error('No healthy database response');
}

function session(response) {
  const value = response.headers.getSetCookie()[0];
  assert.ok(value, 'Missing session cookie');
  if (mode !== 'baseline') {
    assert.ok(/;\s*Secure(?:;|$)/i.test(value), 'Cookie must be Secure');
  }
  assert.ok(/;\s*HttpOnly(?:;|$)/i.test(value), 'Cookie must be HttpOnly');
  assert.ok(/;\s*SameSite=Lax(?:;|$)/i.test(value), 'Cookie must be SameSite=Lax');
  return value.split(';')[0];
}

async function login(password, mustChangePassword) {
  assert.ok(password, 'Smoke password was not supplied');
  const response = await expectResponse('/api/auth/login', 200, { body: { password } });
  assert.equal((await response.json()).mustChangePassword, mustChangePassword);
  return session(response);
}

async function firstLogin() {
  await expectResponse('/v1/models', 401);
  const page = await expectResponse('/login/', 200);
  assert.match(page.headers.get('content-security-policy') ?? '', /script-src 'self' 'sha256-/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  await expectResponse('/openapi.json', 200);
  const cookie = await login(INITIAL_PASSWORD, true);
  await expectResponse('/api/chats', 403, { cookie });
  const changed = await expectResponse('/api/auth/password', 200, { cookie, body: {
    currentPassword: INITIAL_PASSWORD, newPassword: OWNER_PASSWORD, confirmation: OWNER_PASSWORD,
  } });
  const owner = session(changed);
  await expectResponse('/api/chats', 403, { cookie: owner, origin: 'https://different-origin.invalid', body: {} });
  return owner;
}

async function seed(cookie) {
  const response = await expectResponse('/api/chats', 201, { cookie, body: { model: 'openai/gpt-4o', title: 'Smoke' } });
  const { chat } = await response.json();
  await expectResponse(`/api/chats/${chat.id}/messages`, 201, { cookie, body: { role: 'user', content: message } });
  return chat.id;
}

async function readMessage(cookie, id) {
  const response = await expectResponse(`/api/chats/${id}/messages?limit=1`, 200, { cookie });
  assert.equal((await response.json()).items[0]?.content, message);
}

async function checkAttachment(cookie, keep = false) {
  const body = new FormData();
  body.set('file', new File([attachment], 'smoke.txt', { type: 'text/plain' }));
  const response = await expectResponse('/api/files', 201, { cookie, body });
  const { files: [file] } = await response.json();
  try {
    const stored = await expectResponse(file.url, 200, { cookie });
    assert.equal(await stored.text(), attachment);
    return file.url;
  } finally {
    if (!keep) await expectResponse(file.url, 200, { cookie, method: 'DELETE' });
  }
}

async function checkArchive(cookie) {
  const passphrase = 'Deployment smoke archive!67';
  const exported = await expectResponse('/api/data/export', 200, { cookie, body: { passphrase } });
  assert.equal(exported.headers.get('cache-control'), 'no-store');
  const bytes = await exported.arrayBuffer();
  assert.ok(bytes.byteLength > 0);
  for (const path of ['/api/data/preview', '/api/data/import']) {
    const body = new FormData();
    body.set('file', new File([bytes], 'smoke.onerouter', { type: 'application/octet-stream' }));
    body.set('passphrase', passphrase);
    if (path.endsWith('/import')) body.set('mode', 'merge');
    const response = await expectResponse(path, 200, { cookie, body });
    assert.ok((await response.json()).manifest, 'Archive response must include its validated manifest');
  }
}

async function exerciseOwner(cookie) {
  const page = await expectResponse('/login/', 200);
  const policy = page.headers.get('content-security-policy') ?? '';
  assert.match(policy, /script-src 'self' 'sha256-/);
  assert.ok(!policy.split(';').find((directive) => directive.trim().startsWith('script-src'))?.includes("'unsafe-inline'"));
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(page.headers.get('cache-control'), 'no-store');
  await expectResponse('/v1/models', 401);
  await expectResponse('/openapi.json', 200);
  const id = await seed(cookie);
  try {
    await readMessage(cookie, id);
    await checkAttachment(cookie);
    await checkArchive(cookie);
    await readMessage(cookie, id);
    return id;
  } catch (error) {
    await request(`/api/chats/${id}`, { cookie, method: 'DELETE' }).catch(() => undefined);
    throw error;
  }
}

await ready();
switch (mode) {
  case 'fresh':
  case 'baseline':
    console.log(await exerciseOwner(await firstLogin()));
    break;
  case 'persist':
    await readMessage(await login(OWNER_PASSWORD, false), chatId);
    break;
  case 'backup-seed': {
    const cookie = await login(OWNER_PASSWORD, false);
    const file = await checkAttachment(cookie, true);
    const response = await expectResponse('/api/providers', 201, { cookie, body: {
      name: 'Backup fixture', type: 'openai', baseUrl: 'https://api.openai.com/v1',
      apiKey: 'backup-fixture-key', models: ['fixture-model'],
    } });
    const { provider } = await response.json();
    console.log(JSON.stringify({ file, providerId: provider.id }));
    break;
  }
  case 'backup-restore': {
    const cookie = await login(OWNER_PASSWORD, false);
    await readMessage(cookie, chatId);
    const { file, providerId } = JSON.parse(process.argv[5]);
    const stored = await expectResponse(file, 200, { cookie });
    assert.equal(await stored.text(), attachment);
    const response = await expectResponse(`/api/providers/${providerId}`, 200, { cookie });
    const { provider } = await response.json();
    assert.equal(provider.name, 'Backup fixture');
    assert.deepEqual(provider.models, ['fixture-model']);
    assert.equal(provider.hasApiKey, true);
    assert.equal(provider.apiKey, undefined);
    break;
  }
  case 'reset':
    await login(OWNER_PASSWORD, true);
    break;
  case 'preview': {
    assert.equal(url.protocol, 'https:');
    // A dedicated preview database can be exercised repeatedly after its first bootstrap.
    const response = await request('/api/auth/login', { body: { password: OWNER_PASSWORD } });
    const cookie = response.ok ? session(response) : await firstLogin();
    await expectResponse('/openapi.json', 200);
    await expectResponse('/v1/models', 401);
    const page = await expectResponse('/login/', 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /script-src 'self' 'sha256-/);
    assert.match(page.headers.get('strict-transport-security') ?? '', /max-age=/);
    const id = await exerciseOwner(cookie);
    try {
      await readMessage(cookie, id);
    } finally {
      await expectResponse(`/api/chats/${id}`, 200, { cookie, method: 'DELETE' });
    }
    break;
  }
  default:
    throw new Error('Unknown deployment smoke mode');
}
