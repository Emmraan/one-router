import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './test-helpers';

let context: TestContext;

beforeEach(async () => {
  context = await createTestContext({ passwordChanged: true });
  await context.login();
});

afterEach(async () => {
  await context.close();
});

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function jsonBody(value: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) };
}

async function createChat(overrides: Record<string, unknown> = {}): Promise<Record<string, unknown> & { id: string }> {
  const response = await context.request('/api/chats', jsonBody({ model: 'gpt-4o', ...overrides }));
  expect(response.status).toBe(201);
  return (await json(response)).chat as Record<string, unknown> & { id: string };
}

async function appendMessage(chatId: string, value: Record<string, unknown> = {}): Promise<Record<string, unknown> & { id: string }> {
  const response = await context.request(`/api/chats/${chatId}/messages`, jsonBody({
    role: 'user', content: 'hello', ...value,
  }));
  expect(response.status).toBe(201);
  return (await json(response)).message as Record<string, unknown> & { id: string };
}

function textFile(content = 'hello from a file', name = 'notes.txt', type = 'text/plain'): FormData {
  const form = new FormData();
  form.append('file', new File([content], name, { type }));
  return form;
}

async function upload(form: FormData): Promise<Response> {
  return context.request('/api/files', { method: 'POST', body: form });
}

describe('chats', () => {
  it('creates, lists, renames, pins, soft deletes, and restores a chat', async () => {
    const chat = await createChat({ title: 'First chat' });
    expect(chat).toMatchObject({ title: 'First chat', model: 'gpt-4o', isPinned: false, deletedAt: null });

    const list = await context.request('/api/chats');
    expect(list.status).toBe(200);
    expect((await json(list)).items).toHaveLength(1);

    const renamed = await context.request(`/api/chats/${chat.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Renamed', isPinned: true }),
    });
    expect(renamed.status).toBe(200);
    expect((await json(renamed)).chat).toMatchObject({ title: 'Renamed', isPinned: true });

    expect((await context.request(`/api/chats/${chat.id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await json(await context.request('/api/chats'))).items).toHaveLength(0);
    const trash = await json(await context.request('/api/chats?trash=true'));
    expect(trash.items).toHaveLength(1);

    expect((await context.request(`/api/chats/${chat.id}/restore`, { method: 'POST' })).status).toBe(200);
    expect((await json(await context.request('/api/chats'))).items).toHaveLength(1);
  });

  it('permanently deletes a chat and its messages', async () => {
    const chat = await createChat();
    await appendMessage(chat.id);
    const response = await context.request(`/api/chats/${chat.id}?permanent=true`, { method: 'DELETE' });
    expect(response.status).toBe(200);
    expect((await context.request(`/api/chats/${chat.id}`)).status).toBe(404);
    expect((await json(await context.request('/api/chats?trash=true'))).items).toHaveLength(0);
  });

  it('validates chat input and unknown ids', async () => {
    expect((await context.request('/api/chats', jsonBody({ title: 'No model' }))).status).toBe(400);
    const chat = await createChat();
    const empty = await context.request(`/api/chats/${chat.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(empty.status).toBe(400);
    expect((await context.request('/api/chats/missing', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{"title":"x"}' })).status).toBe(404);
    expect((await context.request('/api/chats/missing/restore', { method: 'POST' })).status).toBe(404);
  });

  it('rejects invalid pagination limits', async () => {
    expect((await context.request('/api/chats?limit=abc')).status).toBe(400);
    expect((await context.request('/api/chats?limit=100000')).status).toBe(400);
  });
});

describe('messages', () => {
  it('appends, lists, edits, and deletes messages', async () => {
    const chat = await createChat();
    const first = await appendMessage(chat.id, { content: 'first' });
    await appendMessage(chat.id, { role: 'assistant', content: 'second' });
    expect(first).toMatchObject({ role: 'user', content: 'first', position: 0 });

    const list = await json(await context.request(`/api/chats/${chat.id}/messages`));
    expect(list.items).toHaveLength(2);
    expect(list.nextCursor).toBeNull();

    const updated = await context.request(`/api/messages/${first.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'edited' }),
    });
    expect(updated.status).toBe(200);
    expect((await json(updated)).message).toMatchObject({ content: 'edited' });

    expect((await context.request(`/api/messages/${first.id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await json(await context.request(`/api/chats/${chat.id}/messages`))).items).toHaveLength(1);
  });

  it('paginates messages with a cursor', async () => {
    const chat = await createChat();
    for (let index = 0; index < 3; index += 1) await appendMessage(chat.id, { content: `message ${index}` });
    const page = await json(await context.request(`/api/chats/${chat.id}/messages?limit=2`));
    expect(page.items).toHaveLength(2);
    expect(typeof page.nextCursor).toBe('string');
    const next = await json(await context.request(`/api/chats/${chat.id}/messages?limit=2&cursor=${encodeURIComponent(page.nextCursor as string)}`));
    expect(next.items).toHaveLength(1);
    expect(next.nextCursor).toBeNull();
  });

  it('rejects messages for missing chats and oversized content', async () => {
    expect((await context.request('/api/chats/missing/messages', jsonBody({ role: 'user', content: 'x' }))).status).toBe(404);
    const chat = await createChat();
    const oversized = await context.request(`/api/chats/${chat.id}/messages`, jsonBody({
      role: 'user', content: 'x'.repeat(100001),
    }));
    expect(oversized.status).toBe(400);
    expect((await context.request('/api/messages/missing', { method: 'DELETE' })).status).toBe(404);
  });
});

describe('files', () => {
  it('uploads, downloads, and deletes a file', async () => {
    const uploaded = await upload(textFile('file contents'));
    expect(uploaded.status).toBe(201);
    const stored = (await json(uploaded)).files as Array<Record<string, unknown>>;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: 'notes.txt', type: 'text/plain', size: 13, url: `/api/files/${stored[0].id}` });

    const download = await context.request(`/api/files/${stored[0].id}`);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('text/plain');
    expect(download.headers.get('content-disposition')).toContain('notes.txt');
    expect(await download.text()).toBe('file contents');

    expect((await context.request(`/api/files/${stored[0].id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await context.request(`/api/files/${stored[0].id}`)).status).toBe(404);
  });

  it('rejects mismatched content, empty files, and too many files', async () => {
    expect((await upload(textFile('not really a png', 'image.png', 'image/png'))).status).toBe(400);
    const empty = new FormData();
    empty.append('file', new File([], 'empty.txt', { type: 'text/plain' }));
    expect((await upload(empty)).status).toBe(400);

    const many = new FormData();
    for (let index = 0; index < 11; index += 1) {
      many.append('file', new File([`file ${index}`], `file-${index}.txt`, { type: 'text/plain' }));
    }
    const response = await upload(many);
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'TOO_MANY_FILES' });
  });

  it('links a file to a message and removes it with the message', async () => {
    const stored = (await json(await upload(textFile()))).files as Array<Record<string, unknown>>;
    const chat = await createChat();
    const message = await appendMessage(chat.id, { attachmentIds: [stored[0].id] });

    const duplicate = await context.request(`/api/chats/${chat.id}/messages`, jsonBody({
      role: 'user', content: 'again', attachmentIds: [stored[0].id],
    }));
    expect(duplicate.status).toBe(400);

    expect((await context.request(`/api/messages/${message.id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await context.request(`/api/files/${stored[0].id}`)).status).toBe(404);
  });
});

describe('providers', () => {
  it('creates, masks, updates, and deletes a provider', async () => {
    const created = await context.request('/api/providers', jsonBody({
      name: 'OpenAI',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-secret-provider-key',
      customHeaders: { 'X-Organization': 'org-secret' },
      models: ['gpt-4o'],
    }));
    expect(created.status).toBe(201);
    const text = await created.clone().text();
    expect(text).not.toContain('sk-secret-provider-key');
    expect(text).not.toContain('org-secret');
    const provider = (await json(created)).provider as Record<string, unknown>;
    expect(provider).toMatchObject({ name: 'OpenAI', type: 'openai', hasApiKey: true, models: ['gpt-4o'] });

    const updated = await context.request(`/api/providers/${provider.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'OpenAI renamed', isActive: false }),
    });
    expect(updated.status).toBe(200);
    expect((await json(updated)).provider).toMatchObject({ name: 'OpenAI renamed', isActive: false });

    expect((await json(await context.request('/api/providers'))).providers).toHaveLength(1);
    expect((await context.request(`/api/providers/${provider.id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await context.request(`/api/providers/${provider.id}`)).status).toBe(404);
  });

  it('rejects invalid provider types and missing ids', async () => {
    expect((await context.request('/api/providers', jsonBody({ name: 'Bad', type: 'unknown', baseUrl: 'https://x.example' }))).status).toBe(400);
    expect((await context.request('/api/providers/missing')).status).toBe(404);
  });
});

describe('settings', () => {
  it('stores, reads, and deletes settings', async () => {
    const put = await context.request('/api/settings/theme', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: { mode: 'dark' } }),
    });
    expect(put.status).toBe(200);
    const settings = await json(await context.request('/api/settings'));
    expect(settings.settings).toEqual({ theme: { mode: 'dark' } });

    expect((await context.request('/api/settings/theme', { method: 'DELETE' })).status).toBe(200);
    expect((await json(await context.request('/api/settings'))).settings).toEqual({});
  });

  it('rejects prototype keys and oversized values', async () => {
    expect((await context.request('/api/settings/__proto__', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x' }),
    })).status).toBe(400);
    expect((await context.request('/api/settings/big', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(70000) }),
    })).status).toBe(400);
  });
});
