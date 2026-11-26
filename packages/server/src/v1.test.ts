import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, openAiSse, sseResponse, type TestContext } from './test-helpers';

let context: TestContext;
let providerId: string;

const baseUrl = 'https://api.openai.com/v1';

beforeEach(async () => {
  context = await createTestContext({
    passwordChanged: true,
    fetch: async () => sseResponse([openAiSse('Hello'), openAiSse(' world'), 'data: [DONE]\n\n']),
  });
  await context.login();
  const created = await context.request('/api/providers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'OpenAI', type: 'openai', baseUrl, apiKey: 'sk-v1-key',
      models: ['gpt-4o', 'gpt-4o-mini'],
    }),
  });
  expect(created.status).toBe(201);
  providerId = ((await created.json()) as { provider: { id: string } }).provider.id;
});

afterEach(async () => {
  await context.close();
});

function completion(body: Record<string, unknown>) {
  return context.request('/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function upstreamBody(): Record<string, unknown> {
  return JSON.parse(String(context.fetchCalls[0].init?.body)) as Record<string, unknown>;
}

describe('GET /v1/models', () => {
  it('lists provider models and aliases in OpenAI shape', async () => {
    await context.request('/api/settings/modelAliases', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: [{ alias: 'fast', target: `${providerId}/gpt-4o-mini` }] }),
    });
    const response = await context.request('/v1/models');
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      object: string;
      data: Array<{ id: string; object: string; owned_by: string }>;
    };
    expect(payload.object).toBe('list');
    const ids = payload.data.map((item) => item.id);
    expect(ids).toContain(`${providerId}/gpt-4o`);
    expect(ids).toContain(`${providerId}/gpt-4o-mini`);
    expect(ids).toContain('fast');
    expect(payload.data.find((item) => item.id === 'fast')?.owned_by).toBe('alias');
    expect(payload.data.every((item) => item.object === 'model')).toBe(true);
  });

  it('ignores malformed aliases', async () => {
    await context.request('/api/settings/modelAliases', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: [
        { alias: 'bad alias', target: `${providerId}/gpt-4o` },
        { alias: 'nope', target: 'no-slash' },
        'not-an-object',
      ] }),
    });
    const response = await context.request('/v1/models');
    const payload = (await response.json()) as { data: Array<{ id: string }> };
    expect(payload.data.map((item) => item.id)).not.toContain('bad alias');
    expect(payload.data.map((item) => item.id)).not.toContain('nope');
  });
});

describe('POST /v1/chat/completions', () => {
  it('returns a non-streaming completion from the upstream SSE stream', async () => {
    const response = await completion({
      model: `${providerId}/gpt-4o`,
      messages: [{ role: 'user', content: 'hi there' }],
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      id: string;
      object: string;
      model: string;
      choices: Array<{ message: { role: string; content: string }; finish_reason: string }>;
    };
    expect(payload.id).toMatch(/^chatcmpl-/);
    expect(payload.object).toBe('chat.completion');
    expect(payload.model).toBe(`${providerId}/gpt-4o`);
    expect(payload.choices[0]).toMatchObject({
      message: { role: 'assistant', content: 'Hello world' },
      finish_reason: 'stop',
    });

    const body = upstreamBody();
    expect(body.model).toBe('gpt-4o');
    expect(body.stream).toBe(true);
    expect(context.fetchCalls[0].url).toBe(`${baseUrl}/chat/completions`);
    expect(new Headers(context.fetchCalls[0].init?.headers).get('authorization')).toBe('Bearer sk-v1-key');
  });

  it('streams OpenAI-compatible chunks and terminates with DONE', async () => {
    const response = await completion({
      model: `${providerId}/gpt-4o`,
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const text = await response.text();
    expect(text).toContain('"object":"chat.completion.chunk"');
    expect(text).toContain('"role":"assistant"');
    expect(text).toContain('"content":"Hello"');
    expect(text).toContain('"content":" world"');
    expect(text).toContain('"finish_reason":"stop"');
    expect(text).toContain('data: [DONE]');
  });

  it('resolves a configured alias to the provider model', async () => {
    await context.request('/api/settings/modelAliases', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: [{ alias: 'fast', target: `${providerId}/gpt-4o-mini` }] }),
    });
    const response = await completion({ model: 'fast', messages: [{ role: 'user', content: 'hi' }] });
    expect(response.status).toBe(200);
    expect(upstreamBody().model).toBe('gpt-4o-mini');
    const payload = (await response.json()) as { model: string };
    expect(payload.model).toBe('fast');
  });

  it('accepts base64 image parts and forwards them as image URLs', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]).toString('base64');
    const response = await completion({
      model: `${providerId}/gpt-4o`,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'describe' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } },
        ],
      }],
    });
    expect(response.status).toBe(200);
    const messages = upstreamBody().messages as Array<{ content: unknown }>;
    expect(messages[0].content).toEqual([
      { type: 'text', text: 'describe' },
      { type: 'image_url', image_url: { url: `data:image/png;base64,${png}` } },
    ]);
  });

  it('rejects unknown models and providers', async () => {
    const unknown = await completion({ model: 'missing/model', messages: [{ role: 'user', content: 'hi' }] });
    expect(unknown.status).toBe(404);
    expect(((await unknown.json()) as { error: { code: string } }).error.code).toBe('MODEL_NOT_FOUND');

    const noSlash = await completion({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] });
    expect(noSlash.status).toBe(400);
    expect(((await noSlash.json()) as { error: { code: string } }).error.code).toBe('MODEL_NOT_FOUND');
  });

  it('rejects a disabled provider', async () => {
    await context.request(`/api/providers/${providerId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    });
    const response = await completion({ model: `${providerId}/gpt-4o`, messages: [{ role: 'user', content: 'hi' }] });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('PROVIDER_DISABLED');
  });

  it('rejects remote image URLs and invalid base64', async () => {
    const remote = await completion({
      model: `${providerId}/gpt-4o`,
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'https://example.com/a.png' } }] }],
    });
    expect(remote.status).toBe(400);
    expect(((await remote.json()) as { error: { code: string } }).error.code).toBe('UNSUPPORTED_CONTENT');

    const invalid = await completion({
      model: `${providerId}/gpt-4o`,
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,!!!!' } }] }],
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: { code: string } }).error.code).toBe('UNSUPPORTED_CONTENT');
  });

  it('validates the request shape', async () => {
    const response = await completion({ model: `${providerId}/gpt-4o`, messages: [] });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });
});
