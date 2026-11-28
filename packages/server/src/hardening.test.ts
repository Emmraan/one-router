import { afterEach, describe, expect, it } from 'vitest';
import { createTestContext, TEST_PASSWORD, type TestContext } from './test-helpers';

let context: TestContext | undefined;
afterEach(async () => { await context?.close(); context = undefined; });

describe('release hardening', () => {
  it('bounds simultaneous login work even when forwarding headers are forged', async () => {
    context = await createTestContext({ passwordChanged: true });
    const responses = await Promise.all(Array.from({ length: 3 }, (_, i) => context!.request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${i}` },
      body: JSON.stringify({ password: 'wrong password entirely' }),
    }, { auth: false })));
    expect(responses.map((response) => response.status).sort()).toEqual([401, 429, 429]);
    for (const response of responses.filter((response) => response.status === 429)) {
      expect(response.headers.get('retry-after')).toBe('1');
      expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED' });
    }
    expect((await context.login(TEST_PASSWORD)).status).toBe(200);
  });

  it('releases login admission after malformed requests', async () => {
    context = await createTestContext({ passwordChanged: true });
    const malformed = await context.request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad',
    }, { auth: false });
    expect(malformed.status).toBe(400);
    expect((await context.login()).status).toBe(200);
  });

  it('does not reserve password work while an unauthenticated body is still arriving', async () => {
    context = await createTestContext({ passwordChanged: true });
    let signalRead!: () => void;
    let release!: () => void;
    const reading = new Promise<void>((resolve) => { signalRead = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    const body = new ReadableStream<Uint8Array>({ async pull(controller) {
      signalRead();
      await released;
      controller.enqueue(new TextEncoder().encode('{bad'));
      controller.close();
    } }, { highWaterMark: 0 });
    const pending = context.request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half',
    } as RequestInit & { duplex: 'half' }, { auth: false });
    let status: number;
    try {
      await reading;
      status = (await context.login()).status;
    } finally {
      release();
      await pending;
    }
    expect(status).toBe(200);
  });

  it('keeps the configured session lifetime when activity slides its expiry', async () => {
    let now = 1_000_000;
    context = await createTestContext({ passwordChanged: true, now: () => now, env: { sessionDays: 1 } });
    await context.login();
    now += 61 * 60 * 1000;
    expect((await context.request('/api/chats')).status).toBe(200);
    now += 2 * 86400000;
    expect((await context.request('/api/chats')).status).toBe(401);
  });

  it.each(['http', 'stream', 'discovery'])('never reflects arbitrary provider credentials from %s failures', async (mode) => {
    const credential = 'fixture-credential-with-no-recognizable-key-prefix';
    context = await createTestContext({ passwordChanged: true, fetch: async () => {
      if (mode === 'discovery') throw new Error(credential);
      if (mode === 'http') return new Response(credential, { status: 502 });
      return new Response(new ReadableStream({ start(controller) { controller.error(new Error(credential)); } }));
    } });
    await context.login();
    const response = await context.request(mode === 'discovery' ? '/api/discovery' : '/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerType: 'openai', apiKey: credential,
        ...(mode === 'discovery' ? {} : { model: 'gpt-4o', messages: [{
          id: 'message', role: 'user', content: 'Hello', timestamp: 1,
        }] }),
      }),
    });
    const text = await response.text();
    expect(text).not.toContain(credential);
    expect(text).toContain('error');
    expect(JSON.stringify(context.logs)).not.toContain(credential);
  });

  it.each([false, true])('keeps gateway stream failures private (stream=%s)', async (stream) => {
    const credential = 'gateway-fixture-credential-with-no-key-prefix';
    context = await createTestContext({ passwordChanged: true, fetch: async () =>
      new Response(new ReadableStream({ start(controller) { controller.error(new Error(credential)); } })) });
    await context.login();
    const created = await context.request('/api/providers', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1',
        apiKey: credential, models: ['gpt-4o'] }),
    });
    expect(created.status).toBe(201);
    const { provider } = await created.json() as { provider: { id: string } };
    const response = await context.request('/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: `${provider.id}/gpt-4o`, stream, messages: [{ role: 'user', content: 'Hello' }] }),
    });
    const text = await response.text();
    expect(text).not.toContain(credential);
    expect(text).toContain('Provider request failed');
    expect(context.fetchCalls).toHaveLength(1);
  });
});
