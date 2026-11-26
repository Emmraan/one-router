import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRepositories } from '@one-router/db';
import { createTestContext, openAiSse, sseResponse, type TestContext } from './test-helpers';

let context: TestContext;
const jsonBody = (value: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
const body = async (response: Response) => response.json() as Promise<Record<string, unknown>>;

beforeEach(async () => {
  context = await createTestContext({ passwordChanged: true, fetch: async () => sseResponse([openAiSse('Improved prompt preserving constraints.'), 'data: [DONE]\n\n']) });
  await context.login();
});
afterEach(async () => context.close());

async function provider() {
  const response = await context.request('/api/providers', jsonBody({ name: 'Fixture', type: 'openai', baseUrl: 'https://fixture.example/v1', apiKey: 'fixture-key', models: ['fixture-model'] }));
  return (await body(response)).provider as { id: string };
}
async function file() {
  const form = new FormData();
  form.set('file', new File(['Unique attachment contents'], 'notes.txt', { type: 'text/plain' }));
  const response = await context.request('/api/files', { method: 'POST', body: form });
  expect(response.status).toBe(201);
  return ((await body(response)).files as Array<{ id: string; name: string }>)[0];
}

describe('web parity contracts', () => {
  it('searches saved message content and keeps trash separate', async () => {
    const repos = createRepositories(context.db);
    const chat = await repos.chats.create(context.ownerId, { title: 'Unrelated title', model: 'fixture-model' });
    await repos.messages.append(context.ownerId, chat.id, { role: 'user', content: 'Needle inside encrypted content' });
    await repos.chats.create(context.ownerId, { title: 'Other chat', model: 'fixture-model' });
    const found = await body(await context.request('/api/chats?q=needle'));
    expect((found.items as Array<{ id: string }>).map((item) => item.id)).toEqual([chat.id]);
    await repos.chats.softDelete(context.ownerId, chat.id);
    expect((await body(await context.request('/api/chats?q=needle'))).items).toEqual([]);
    expect((await body(await context.request('/api/chats?q=needle&trash=true'))).items).toHaveLength(1);
  });

  it('returns safe attachment metadata after append and reload', async () => {
    const uploaded = await file();
    const chat = (await body(await context.request('/api/chats', jsonBody({ model: 'fixture-model' })))).chat as { id: string };
    const response = await context.request(`/api/chats/${chat.id}/messages`, jsonBody({ role: 'user', content: '', attachmentIds: [uploaded.id] }));
    const message = (await body(response)).message as { attachments: unknown[] };
    expect(message.attachments).toEqual([expect.objectContaining({ id: uploaded.id, name: 'notes.txt', type: 'text/plain', url: `/api/files/${uploaded.id}` })]);
    const reloaded = await context.request(`/api/chats/${chat.id}/messages`);
    const raw = await reloaded.text();
    expect(JSON.parse(raw).items[0].attachments).toEqual(message.attachments);
    expect(raw).not.toMatch(/objectKey|base64|Unique attachment contents/);
  });

  it('keeps ephemeral uploads out of chats until an atomic Save chat', async () => {
    const uploaded = await file();
    expect((await body(await context.request('/api/chats'))).items).toEqual([]);
    const response = await context.request('/api/chats/save', jsonBody({ title: 'Saved temporary conversation', model: 'fixture-model', messages: [
      { role: 'user', content: 'Read this', attachmentIds: [uploaded.id] }, { role: 'assistant', content: 'Read it.' },
    ] }));
    expect(response.status).toBe(201);
    const saved = (await body(response)).chat as { id: string; title: string };
    expect(saved.title).toBe('Saved temporary conversation');
    expect((await body(await context.request(`/api/chats/${saved.id}/messages`))).items).toHaveLength(2);
    expect((await createRepositories(context.db).attachments.get(context.ownerId, uploaded.id))?.expiresAt).toBeNull();
  });

  it('rolls back a partial Save chat and retains uploads for retry', async () => {
    const uploaded = await file();
    const response = await context.request('/api/chats/save', jsonBody({ title: 'Must roll back', model: 'fixture-model', messages: [
      { role: 'user', content: 'first', attachmentIds: [uploaded.id] }, { role: 'assistant', content: 'bad attachment', attachmentIds: ['missing-file'] },
    ] }));
    expect(response.status).toBe(400);
    expect((await body(await context.request('/api/chats'))).items).toEqual([]);
    expect((await createRepositories(context.db).attachments.get(context.ownerId, uploaded.id))?.messageId).toBeNull();
  });

  it('enhances through the selected provider and exposes failures without fallback text', async () => {
    const selected = await provider();
    const response = await context.request('/api/enhance', jsonBody({ prompt: 'Keep the answer in French and under 50 words.', providerId: selected.id, model: 'fixture-model' }));
    expect(response.status).toBe(200);
    expect(await body(response)).toEqual({ enhanced: 'Improved prompt preserving constraints.' });
    expect(context.fetchCalls[0].url).toBe('https://fixture.example/v1/chat/completions');
    const missing = await context.request('/api/enhance', jsonBody({ prompt: 'Original prompt', providerId: 'missing', model: 'fixture-model' }));
    expect(missing.status).toBe(400);
    const unconfigured = await context.request('/api/enhance', jsonBody({ prompt: 'Original prompt' }));
    expect(unconfigured.status).toBe(400);
  });

  it('hydrates text upload contents by ID without accepting client base64', async () => {
    const selected = await provider();
    const uploaded = await file();
    const response = await context.request('/api/chat', jsonBody({ providerId: selected.id, model: 'fixture-model', messages: [
      { id: 'ephemeral-message', role: 'user', content: 'Read it', timestamp: Date.now(), attachments: [{ ...uploaded, type: 'text/plain', size: 26, url: `/api/files/${uploaded.id}` }] },
    ] }));
    expect(response.status).toBe(200);
    await response.text();
    expect(context.fetchCalls[0].init?.body).toContain('Unique attachment contents');
    expect((await body(await context.request('/api/chats'))).items).toEqual([]);
  });
});
