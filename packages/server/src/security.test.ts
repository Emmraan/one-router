import { afterEach, describe, expect, it } from 'vitest';
import { sseResponse } from './test-helpers';
import { createTestContext, TEST_ORIGIN, TEST_PASSWORD, type TestContext } from './test-helpers';

let context: TestContext | undefined;

afterEach(async () => {
  await context?.close();
  context = undefined;
});

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('authentication gate', () => {
  it.each([
    ['GET', '/api/chats'],
    ['POST', '/api/chats'],
    ['GET', '/api/providers'],
    ['GET', '/api/settings'],
    ['GET', '/api/files/anything'],
    ['GET', '/api/auth/me'],
    ['POST', '/api/chat'],
    ['POST', '/api/title'],
    ['POST', '/api/enhance'],
    ['POST', '/api/discovery'],
    ['POST', '/api/data/export'],
    ['GET', '/v1/models'],
    ['POST', '/v1/chat/completions'],
  ])('rejects unauthenticated %s %s', async (method, path) => {
    context = await createTestContext({ passwordChanged: true });
    const response = await context.request(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'POST' ? '{}' : undefined,
    }, { auth: false });
    expect(response.status).toBe(401);
    const payload = await body(response);
    expect(payload.code).toBe('UNAUTHENTICATED');
    expect(typeof payload.requestId).toBe('string');
  });

  it('keeps the auth status endpoint public', async () => {
    context = await createTestContext({ passwordChanged: true });
    const response = await context.request('/api/auth/status', {}, { auth: false });
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ authenticated: false, mustChangePassword: false });
  });

  it('does not reveal whether the owner exists or the password was close', async () => {
    context = await createTestContext({ passwordChanged: true });
    const response = await context.login('wrong password entirely');
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await body(response)).toMatchObject({ code: 'INVALID_CREDENTIALS', error: 'Invalid password' });
  });

  it('sets a hardened session cookie on login', async () => {
    context = await createTestContext({ passwordChanged: true });
    const response = await context.login();
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('one_router_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=');
    expect(cookie).not.toContain('Secure');
  });
});

describe('forced password change', () => {
  it('blocks the API until the bootstrap password is replaced', async () => {
    context = await createTestContext();
    expect((await context.login()).status).toBe(200);
    const blocked = await context.request('/api/chats');
    expect(blocked.status).toBe(403);
    expect(await body(blocked)).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });

    const status = await context.request('/api/auth/status');
    expect(await body(status)).toMatchObject({ authenticated: true, mustChangePassword: true });
  });

  it('rejects a weak password, a wrong current password, and a mismatched confirmation', async () => {
    context = await createTestContext();
    await context.login();

    const weak = await context.request('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: TEST_PASSWORD, newPassword: 'short', confirmation: 'short' }),
    });
    expect(weak.status).toBe(400);
    const weakBody = await body(weak);
    expect(weakBody.code).toBe('WEAK_PASSWORD');
    expect(Array.isArray(weakBody.details)).toBe(true);

    const wrong = await context.request('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'not the password', newPassword: 'a much better passphrase 42', confirmation: 'a much better passphrase 42',
      }),
    });
    expect(wrong.status).toBe(400);
    expect(await body(wrong)).toMatchObject({ code: 'INVALID_CREDENTIALS' });

    const mismatch = await context.request('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: TEST_PASSWORD, newPassword: 'a much better passphrase 42', confirmation: 'a much better passphrase 43',
      }),
    });
    expect(mismatch.status).toBe(400);
    expect(await body(mismatch)).toMatchObject({ code: 'WEAK_PASSWORD' });
  });

  it('revokes the old session after a successful change', async () => {
    context = await createTestContext();
    await context.login();
    const oldCookie = context.getCookie();
    const newPassword = 'a much better passphrase 42';

    const changed = await context.request('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: TEST_PASSWORD, newPassword, confirmation: newPassword }),
    });
    expect(changed.status).toBe(200);
    expect(await body(changed)).toMatchObject({ ok: true, mustChangePassword: false });
    context.setCookieFrom(changed);

    const withOldCookie = await context.request('/api/chats', {
      headers: { cookie: `one_router_session=${oldCookie}` },
    }, { auth: false });
    expect(withOldCookie.status).toBe(401);

    expect((await context.request('/api/chats')).status).toBe(200);
    const oldLogin = await context.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    }, { auth: false });
    expect(oldLogin.status).toBe(401);
    const newLogin = await context.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    }, { auth: false });
    expect(newLogin.status).toBe(200);
  });
});

describe('sessions and bearer tokens', () => {
  it('revokes the session on logout', async () => {
    context = await createTestContext({ passwordChanged: true });
    await context.login();
    const cookie = context.getCookie();
    expect((await context.request('/api/auth/me')).status).toBe(200);
    expect((await context.request('/api/auth/logout', { method: 'POST' })).status).toBe(200);

    const replay = await context.request('/api/chats', {
      headers: { cookie: `one_router_session=${cookie}` },
    }, { auth: false });
    expect(replay.status).toBe(401);
  });

  it('accepts the configured bearer token and exempts it from CSRF origin checks', async () => {
    context = await createTestContext({
      passwordChanged: true,
      env: { authToken: 'test-bearer-token-1234567890' },
    });
    const response = await context.request('/api/chats', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-bearer-token-1234567890',
        origin: 'http://evil.example',
      },
      body: JSON.stringify({ model: 'gpt-4o' }),
    }, { auth: false, origin: null });
    expect(response.status).toBe(201);
  });

  it('rejects an invalid bearer token without falling back to the cookie', async () => {
    context = await createTestContext({
      passwordChanged: true,
      env: { authToken: 'test-bearer-token-1234567890' },
    });
    await context.login();
    const response = await context.request('/api/chats', {
      headers: { authorization: 'Bearer not-the-token' },
    }, { origin: null });
    expect(response.status).toBe(401);
  });

  it('does not let a bearer token bypass the forced password change', async () => {
    context = await createTestContext({
      env: { authToken: 'test-bearer-token-1234567890' },
    });
    const response = await context.request('/api/chats', {
      headers: { authorization: 'Bearer test-bearer-token-1234567890' },
    }, { auth: false, origin: null });
    expect(response.status).toBe(403);
    expect(await body(response)).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
  });

  it('expires sessions after the configured lifetime', async () => {
    let now = 1_000_000;
    context = await createTestContext({ passwordChanged: true, now: () => now, env: { sessionDays: 1 } });
    await context.login();
    expect((await context.request('/api/chats')).status).toBe(200);
    now += 2 * 86400000;
    expect((await context.request('/api/chats')).status).toBe(401);
  });

  it('slides the browser cookie when the session is touched', async () => {
    let now = 1_000_000;
    context = await createTestContext({ passwordChanged: true, now: () => now });
    await context.login();
    now += 61 * 60 * 1000;
    const response = await context.request('/api/chats');
    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('one_router_session=');
    expect(cookie).toContain('Max-Age=');
    expect(cookie).toContain('HttpOnly');
  });
});

describe('CSRF protection', () => {
  it.each([
    ['missing origin', null, undefined],
    ['null origin', 'null', undefined],
    ['cross-site origin', 'http://evil.example', undefined],
    ['missing origin without fetch metadata', null, 'cross-site'],
  ])('rejects unsafe requests with %s', async (_name, origin, fetchSite) => {
    context = await createTestContext({ passwordChanged: true });
    await context.login();
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (fetchSite) headers['sec-fetch-site'] = fetchSite;
    const response = await context.request('/api/chats', {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: 'gpt-4o' }),
    }, { origin });
    expect(response.status).toBe(403);
    expect(await body(response)).toMatchObject({ code: 'CSRF_REJECTED' });
  });

  it('accepts same-origin fetch metadata without an Origin header', async () => {
    context = await createTestContext({ passwordChanged: true });
    await context.login();
    const response = await context.request('/api/chats', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify({ model: 'gpt-4o' }),
    }, { origin: null });
    expect(response.status).toBe(201);
  });

  it('leaves safe methods alone', async () => {
    context = await createTestContext({ passwordChanged: true });
    await context.login();
    expect((await context.request('/api/chats', {}, { origin: null })).status).toBe(200);
  });
});

describe('login throttling and account lockout', () => {
  it('locks the account after five failures and releases it after fifteen minutes', async () => {
    let now = 5_000_000;
    context = await createTestContext({ passwordChanged: true, now: () => now });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await context.login('wrong password entirely')).status).toBe(401);
    }
    expect((await context.login()).status).toBe(401);
    now += 15 * 60000 + 1;
    expect((await context.login()).status).toBe(200);
  });

  it('rate limits the login endpoint by client address', async () => {
    context = await createTestContext({ passwordChanged: true });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await context.login('wrong password entirely');
      expect(response.status).toBe(401);
    }
    const limited = await context.login('wrong password entirely');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBeTruthy();
    expect(await body(limited)).toMatchObject({ code: 'RATE_LIMITED' });
  });
});

describe('request hygiene', () => {
  it('echoes a valid request id and replaces an invalid one', async () => {
    context = await createTestContext({ passwordChanged: true });
    const echoed = await context.request('/health', { headers: { 'x-request-id': 'client-request_1' } }, { auth: false });
    expect(echoed.headers.get('x-request-id')).toBe('client-request_1');

    const replaced = await context.request('/health', { headers: { 'x-request-id': 'bad id with spaces' } }, { auth: false });
    expect(replaced.headers.get('x-request-id')).not.toBe('bad id with spaces');
    expect(replaced.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('includes the request id in error envelopes', async () => {
    context = await createTestContext({ passwordChanged: true });
    await context.login();
    const response = await context.request('/api/does-not-exist');
    expect(response.status).toBe(404);
    const payload = await body(response);
    expect(payload.code).toBe('NOT_FOUND');
    expect(payload.requestId).toBe(response.headers.get('x-request-id'));
  });

  it('emits security headers and no-store on API responses', async () => {
    context = await createTestContext({ passwordChanged: true });
    const health = await context.request('/health', {}, { auth: false });
    expect(health.headers.get('x-content-type-options')).toBe('nosniff');
    expect(health.headers.get('x-frame-options')).toBe('DENY');
    expect(health.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(health.headers.get('referrer-policy')).toBe('no-referrer');
    expect(health.headers.get('strict-transport-security')).toBeNull();

    await context.login();
    const chats = await context.request('/api/chats');
    expect(chats.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects oversized declared bodies before reading them', async () => {
    context = await createTestContext({ passwordChanged: true });
    await context.login();
    const response = await context.request('/api/chats', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(81 * 1024 * 1024) },
      body: '{}',
    });
    expect(response.status).toBe(413);
    expect(await body(response)).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('rejects invalid JSON with a validation envelope', async () => {
    context = await createTestContext({ passwordChanged: true });
    await context.login();
    const response = await context.request('/api/chats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({ code: 'INVALID_JSON' });
  });

  it('never logs the submitted password', async () => {
    context = await createTestContext({ passwordChanged: true });
    await context.login('wrong password entirely');
    const serialized = JSON.stringify(context.logs);
    expect(serialized).not.toContain('wrong password entirely');
    expect(serialized).not.toContain(TEST_PASSWORD);
    expect(context.logs.some((entry) => entry.path === '/api/auth/login')).toBe(true);
  });

  it('redacts upstream secrets from error responses', async () => {
    context = await createTestContext({
      passwordChanged: true,
      fetch: async () => sseResponse([
        '{"error":{"message":"bad key sk-secret1234567890"}}',
      ], 401),
    });
    await context.login();
    const response = await context.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerType: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        messages: [{ id: 'm1', role: 'user', content: 'hello', timestamp: 1 }],
      }),
    });
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).not.toContain('sk-secret1234567890');
    expect(text).toContain('[redacted]');
  });

  it('redacts upstream secrets inside streamed error events', async () => {
    context = await createTestContext({
      passwordChanged: true,
      fetch: async () => sseResponse([
        'data: {"error":"upstream rejected sk-secret1234567890"}\n\n',
      ]),
    });
    await context.login();
    const response = await context.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerType: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o',
        messages: [{ id: 'm1', role: 'user', content: 'hello', timestamp: 1 }],
      }),
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain('sk-secret1234567890');
    expect(text).toContain('[redacted]');
  });

  it('serves health and OpenAPI without a session', async () => {
    context = await createTestContext({ passwordChanged: true });
    const health = await context.request('/health', {}, { auth: false });
    expect(health.status).toBe(200);
    expect(await body(health)).toMatchObject({ status: 'ok', database: 'ok' });

    const spec = await context.request('/openapi.json', {}, { auth: false });
    expect(spec.status).toBe(200);
    const document = await body(spec);
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths as object)).toContain('/v1/chat/completions');
  });

  it('answers CORS preflight only for allowed origins', async () => {
    context = await createTestContext({ passwordChanged: true });
    const allowed = await context.request('/api/chats', { method: 'OPTIONS' }, { auth: false });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(TEST_ORIGIN);
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true');

    const denied = await context.request('/api/chats', { method: 'OPTIONS' }, { auth: false, origin: 'http://evil.example' });
    expect(denied.status).toBe(403);
  });
});
