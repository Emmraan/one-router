import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openAiSse, sseResponse, createTestContext, type TestContext } from './test-helpers';

let context: TestContext;

beforeEach(async () => {
  context = await createTestContext({
    passwordChanged: true,
    fetch: async () => sseResponse([openAiSse('ok'), 'data: [DONE]\n\n']),
  });
  await context.login();
});

afterEach(async () => {
  await context.close();
});

const userMessage = { id: 'm1', role: 'user' as const, content: 'hello', timestamp: 1 };

async function recreate(options: Parameters<typeof createTestContext>[0] = {}) {
  await context.close();
  context = await createTestContext({ passwordChanged: true, ...options });
  await context.login();
}

function chatBody(overrides: Record<string, unknown> = {}) {
  return { providerType: 'openai', apiKey: 'sk-test', model: 'gpt-4o', messages: [userMessage], ...overrides };
}

function postChat(body: Record<string, unknown>) {
  return context.request('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function requestBody(call: { init?: RequestInit }): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>;
}

function requestHeaders(call: { init?: RequestInit }): Headers {
  return new Headers(call.init?.headers);
}

async function upload(name = 'notes.txt', content = 'attachment body'): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.set('file', new File([content], name, { type: 'text/plain' }));
  const response = await context.request('/api/files', { method: 'POST', body: form });
  expect(response.status).toBe(201);
  const payload = (await response.json()) as { files: Record<string, unknown>[] };
  return payload.files[0];
}

describe('chat streaming', () => {
  it('streams OpenAI text as data events and forwards the request', async () => {
    await recreate({
      fetch: async () => sseResponse([
        openAiSse('Hel'),
        openAiSse('lo'),
        'data: [DONE]\n\n',
      ]),
    });

    const response = await postChat(chatBody());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const text = await response.text();
    expect(text).toContain('data: {"text":"Hel"}');
    expect(text).toContain('data: {"text":"lo"}');

    expect(context.fetchCalls).toHaveLength(1);
    const call = context.fetchCalls[0];
    expect(call.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(requestHeaders(call).get('authorization')).toBe('Bearer sk-test');
    const body = requestBody(call);
    expect(body.model).toBe('gpt-4o');
    expect(body.stream).toBe(true);
    expect((body.messages as Array<{ content: string }>)[0].content).toBe('hello');
  });

  it('resolves a stored provider and its encrypted key by provider id', async () => {
    await recreate({ fetch: async () => sseResponse([openAiSse('ok'), 'data: [DONE]\n\n']) });
    const created = await context.request('/api/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Work OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-stored-key',
      }),
    });
    expect(created.status).toBe(201);
    const provider = ((await created.json()) as { provider: { id: string } }).provider;

    const response = await postChat({
      providerId: provider.id, model: 'gpt-4o', messages: [userMessage],
    });
    expect(response.status).toBe(200);
    expect(requestHeaders(context.fetchCalls[0]).get('authorization')).toBe('Bearer sk-stored-key');
  });

  it('rejects a provider type that does not match the stored provider', async () => {
    const created = await context.request('/api/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-key' }),
    });
    const provider = ((await created.json()) as { provider: { id: string } }).provider;
    const response = await postChat({ providerId: provider.id, providerType: 'anthropic', model: 'gpt-4o', messages: [userMessage] });
    expect(response.status).toBe(400);
    expect((await response.json()) as { code: string }).toMatchObject({ code: 'PROVIDER_MISMATCH' });
  });

  it('rejects a disabled provider', async () => {
    const created = await context.request('/api/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-key' }),
    });
    const provider = ((await created.json()) as { provider: { id: string } }).provider;
    await context.request(`/api/providers/${provider.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    const response = await postChat({ providerId: provider.id, model: 'gpt-4o', messages: [userMessage] });
    expect(response.status).toBe(400);
    expect((await response.json()) as { code: string }).toMatchObject({ code: 'PROVIDER_DISABLED' });
  });

  it('requires a key for hosted providers and allows Ollama without one', async () => {
    const missing = await postChat({ providerType: 'openai', model: 'gpt-4o', messages: [userMessage] });
    expect(missing.status).toBe(400);
    expect((await missing.json()) as { code: string }).toMatchObject({ code: 'PROVIDER_KEY_MISSING' });

    const required = await postChat({ model: 'gpt-4o', messages: [userMessage] });
    expect(required.status).toBe(400);
    expect((await required.json()) as { code: string }).toMatchObject({ code: 'PROVIDER_REQUIRED' });
  });

  it('streams Ollama responses without an API key', async () => {
    await recreate({
      fetch: async () => sseResponse([openAiSse('Hi'), 'data: [DONE]\n\n']),
    });
    const response = await postChat({
      providerType: 'ollama', baseUrl: 'http://localhost:11434', model: 'llama3', messages: [userMessage],
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"text":"Hi"');
    expect(context.fetchCalls[0].url).toBe('http://localhost:11434/chat/completions');
  });

  it('passes upstream failures through with a redacted message', async () => {
    await recreate({
      fetch: async () => new Response('bad key sk-secret1234567890', { status: 429 }),
    });
    const response = await postChat(chatBody());
    expect(response.status).toBe(429);
    const text = await response.text();
    expect(text).not.toContain('sk-secret1234567890');
    expect(text).toContain('UPSTREAM_STATUS');
  });
});

describe('chat attachments', () => {
  it('hydrates an uploaded attachment before calling the provider', async () => {
    const file = await upload();
    context.fetchCalls.length = 0;
    const response = await postChat(chatBody({
      messages: [{
        ...userMessage,
        attachments: [{ id: file.id, name: file.name, type: file.type, size: file.size, url: file.url }],
      }],
    }));
    expect(response.status).toBe(200);
    expect(String(context.fetchCalls[0].init?.body)).toContain('[File: notes.txt]');
    expect(String(context.fetchCalls[0].init?.body)).toContain('attachment body');
    expect(String(context.fetchCalls[0].init?.body)).toContain('[End file]');
  });

  it('rejects missing and duplicate attachments', async () => {
    const missing = await postChat(chatBody({
      messages: [{ ...userMessage, attachments: [{ id: 'missing', name: 'x', type: 'text/plain', size: 1, url: '' }] }],
    }));
    expect(missing.status).toBe(400);
    expect((await missing.json()) as { code: string }).toMatchObject({ code: 'ATTACHMENT_NOT_FOUND' });

    const file = await upload();
    const attachment = { id: file.id, name: file.name, type: file.type, size: file.size, url: file.url };
    const duplicate = await postChat(chatBody({
      messages: [{ ...userMessage, attachments: [attachment, attachment] }],
    }));
    expect(duplicate.status).toBe(400);
    expect((await duplicate.json()) as { code: string }).toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('limits attachments per message', async () => {
    const file = await upload();
    const attachment = { id: file.id, name: file.name, type: file.type, size: file.size, url: file.url };
    const response = await postChat(chatBody({
      messages: [{ ...userMessage, attachments: new Array(11).fill(attachment) }],
    }));
    expect(response.status).toBe(400);
    expect((await response.json()) as { code: string }).toMatchObject({ code: 'TOO_MANY_FILES' });
  });
});

describe('titles', () => {
  it('falls back to a derived title without a Gemini key', async () => {
    const response = await context.request('/api/title', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'one two three four five six' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ title: 'one two three four five...' });
  });

  it('uses the Gemini provider key and normalizes the response', async () => {
    await recreate({
      fetch: async () => Response.json({ candidates: [{ content: { parts: [{ text: '  "Fake Title"  ' }] } }] }),
    });
    await context.request('/api/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Gemini', type: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'gemini-key',
      }),
    });
    const response = await context.request('/api/title', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'explain closures' }),
    });
    expect(await response.json()).toEqual({ title: 'Fake Title' });
    expect(context.fetchCalls[0].url).toContain('gemini-2.0-flash:generateContent');
    expect(context.fetchCalls[0].url).toContain('key=gemini-key');
  });

  it('returns the derived title when the provider fails', async () => {
    await recreate({
      fetch: async () => new Response('nope', { status: 500 }),
    });
    const response = await context.request('/api/title', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hello there world', apiKey: 'gemini-key' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ title: 'hello there world' });
  });

  it('returns New Chat for an empty message', async () => {
    const response = await context.request('/api/title', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    });
    expect(await response.json()).toEqual({ title: 'New Chat' });
  });
});

describe('prompt enhancement', () => {
  it('requires a provider instead of returning a fake rewrite', async () => {
    const response = await context.request('/api/enhance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'make this better' }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()) as { code: string }).toMatchObject({ code: 'PROVIDER_REQUIRED' });
  });

  it('uses the Gemini provider when configured', async () => {
    await recreate({
      fetch: async () => Response.json({ candidates: [{ content: { parts: [{ text: '  Better prompt  ' }] } }] }),
    });
    await context.request('/api/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Gemini', type: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'gemini-key',
      }),
    });
    const response = await context.request('/api/enhance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'make this better' }),
    });
    expect(await response.json()).toEqual({ enhanced: 'Better prompt' });
  });

  it('fails visibly when the provider fails', async () => {
    await recreate({
      fetch: async () => new Response('nope', { status: 500 }),
    });
    const response = await context.request('/api/enhance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'make this better', apiKey: 'gemini-key' }),
    });
    expect(response.status).toBe(500);
    expect((await response.json()) as { code: string }).toMatchObject({ code: 'ENHANCE_FAILED' });
  });

  it('rejects an empty prompt', async () => {
    const response = await context.request('/api/enhance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: '   ' }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()) as { code: string }).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('model discovery', () => {
  it('returns discovered models sorted', async () => {
    await recreate({
      fetch: async () => Response.json({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] }),
    });
    const response = await context.request('/api/discovery', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerType: 'openai', apiKey: 'sk-test' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, models: ['gpt-4o', 'gpt-4o-mini'] });
    expect(context.fetchCalls[0].url).toBe('https://api.openai.com/v1/models');
  });

  it('reports connection failures without failing the request', async () => {
    await recreate({
      fetch: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    });
    const response = await context.request('/api/discovery', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerType: 'openai', apiKey: 'sk-test' }),
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { success: boolean; error: string };
    expect(payload.success).toBe(false);
    expect(payload.error).toContain('Provider request failed');
    expect(payload.error).not.toContain('ECONNREFUSED');
  });

  it('redacts secrets from discovery failures', async () => {
    await recreate({
      fetch: async () => {
        throw new Error('provider rejected sk-secret1234567890');
      },
    });
    const response = await context.request('/api/discovery', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerType: 'openai', apiKey: 'sk-test' }),
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { success: boolean; error: string };
    expect(payload.success).toBe(false);
    expect(payload.error).not.toContain('sk-secret1234567890');
    expect(payload.error).toContain('Provider request failed');
  });
});
