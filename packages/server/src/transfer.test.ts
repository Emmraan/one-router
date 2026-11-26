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

const PASSPHRASE = 'correct horse battery staple';
const FILE_BYTES = 'archived attachment';

async function switchContext(options: Parameters<typeof createTestContext>[0] = {}) {
  await context.close();
  context = await createTestContext({ passwordChanged: true, ...options });
  await context.login();
}

async function seed(target: TestContext) {
  const providerResponse = await target.request('/api/providers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Archive OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-archive-secret',
    }),
  });
  expect(providerResponse.status).toBe(201);
  const provider = ((await providerResponse.json()) as { provider: { id: string } }).provider;

  const chatResponse = await target.request('/api/chats', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Archive chat', model: 'gpt-4o', providerId: provider.id }),
  });
  expect(chatResponse.status).toBe(201);
  const chat = ((await chatResponse.json()) as { chat: { id: string } }).chat;

  const userResponse = await target.request(`/api/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'user', content: 'hello archive' }),
  });
  expect(userResponse.status).toBe(201);

  const form = new FormData();
  form.set('file', new File([FILE_BYTES], 'notes.txt', { type: 'text/plain' }));
  const uploadResponse = await target.request('/api/files', { method: 'POST', body: form });
  expect(uploadResponse.status).toBe(201);
  const file = ((await uploadResponse.json()) as { files: Array<{ id: string }> }).files[0];

  const assistantResponse = await target.request(`/api/chats/${chat.id}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'assistant', content: 'reply', attachmentIds: [file.id] }),
  });
  expect(assistantResponse.status).toBe(201);

  await target.request('/api/settings/theme', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ value: 'dark' }),
  });
  return { providerId: provider.id, chatId: chat.id, fileId: file.id };
}

async function exportArchive(passphrase = PASSPHRASE): Promise<{ bytes: Uint8Array; manifest: Record<string, unknown> }> {
  const response = await context.request('/api/data/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/octet-stream');
  expect(response.headers.get('content-disposition')).toContain('.onerouter');
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(Buffer.from(bytes.subarray(0, 10)).toString('binary')).toBe('ONEROUTER\x01');
  const manifest = await preview(bytes, passphrase);
  return { bytes, manifest };
}

async function exportPlaintext(): Promise<{ document: Record<string, unknown>; text: string }> {
  const response = await context.request('/api/data/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plaintext: true }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('content-disposition')).toContain('.json');
  const text = await response.text();
  return { document: JSON.parse(text) as Record<string, unknown>, text };
}

function archiveForm(bytes: Uint8Array | string, fields: Record<string, string> = {}): FormData {
  const form = new FormData();
  const body = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const copy = new ArrayBuffer(body.byteLength);
  new Uint8Array(copy).set(body);
  form.set('file', new File([copy], 'backup.onerouter', { type: 'application/octet-stream' }));
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

async function preview(bytes: Uint8Array, passphrase?: string) {
  const response = await context.request('/api/data/preview', {
    method: 'POST',
    body: archiveForm(bytes, passphrase ? { passphrase } : {}),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { manifest: Record<string, unknown> }).manifest;
}

async function importArchive(bytes: Uint8Array | string, mode: string, passphrase?: string) {
  return context.request('/api/data/import', {
    method: 'POST',
    body: archiveForm(bytes, { mode, ...(passphrase ? { passphrase } : {}) }),
  });
}

describe('plaintext export', () => {
  it('exports the archive document without provider credentials', async () => {
    await seed(context);
    const { document, text } = await exportPlaintext();
    const manifest = document.manifest as { counts: Record<string, number> };
    expect(manifest.counts).toMatchObject({ providers: 1, chats: 1, messages: 2, attachments: 1, settings: 1 });
    const data = document.data as { providers: Array<Record<string, unknown>>; attachments: Array<{ data: string }> };
    expect(data.providers[0]).not.toHaveProperty('apiKey');
    expect(data.providers[0]).not.toHaveProperty('customHeaders');
    expect(Buffer.from(data.attachments[0].data, 'base64').toString('utf8')).toBe(FILE_BYTES);
    expect(text).not.toContain('sk-archive-secret');
  });

  it('rejects a request that asks for both encrypted and plaintext export', async () => {
    const response = await context.request('/api/data/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase: PASSPHRASE, plaintext: true }),
    });
    expect(response.status).toBe(400);
  });

  it('rejects a short passphrase', async () => {
    const response = await context.request('/api/data/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase: 'short' }),
    });
    expect(response.status).toBe(400);
  });
});

describe('encrypted export and preview', () => {
  it('round-trips the manifest through preview', async () => {
    await seed(context);
    const { manifest } = await exportArchive();
    expect((manifest.counts as Record<string, number>)).toMatchObject({ providers: 1, chats: 1, messages: 2, attachments: 1 });
    expect(manifest.format).toBe('onerouter');
  });

  it('rejects a wrong or missing passphrase', async () => {
    await seed(context);
    const { bytes } = await exportArchive();
    const wrong = await context.request('/api/data/preview', {
      method: 'POST',
      body: archiveForm(bytes, { passphrase: 'not the right passphrase' }),
    });
    expect(wrong.status).toBe(400);
    expect(((await wrong.json()) as { code: string }).code).toBe('INVALID_ARCHIVE');

    const missing = await context.request('/api/data/preview', {
      method: 'POST',
      body: archiveForm(bytes),
    });
    expect(missing.status).toBe(400);
  });

  it('rejects a corrupted archive', async () => {
    const response = await context.request('/api/data/preview', {
      method: 'POST',
      body: archiveForm('this is not an archive'),
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('INVALID_ARCHIVE');
  });
});

describe('import', () => {
  it('merges a plaintext archive into the current account', async () => {
    await seed(context);
    const { text } = await exportPlaintext();
    const response = await importArchive(text, 'merge');
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { imported: Record<string, number> };
    expect(payload.imported).toMatchObject({ providers: 1, chats: 1, messages: 2, attachments: 1 });

    const chats = await context.request('/api/chats');
    const items = ((await chats.json()) as { items: Array<{ id: string; title: string }> }).items;
    expect(items).toHaveLength(2);
    const importedChat = items.find((chat) => chat.title === 'Archive chat' && chat.id !== undefined);
    expect(importedChat).toBeTruthy();

    const messages = await context.request(`/api/chats/${importedChat!.id}/messages`);
    const messageItems = ((await messages.json()) as { items: Array<{ role: string; id: string }> }).items;
    expect(messageItems).toHaveLength(2);
    const assistant = messageItems.find((message) => message.role === 'assistant');
    expect(assistant).toBeTruthy();
  });

  it('replaces existing data with an encrypted archive and keeps credentials', async () => {
    await seed(context);
    const { bytes } = await exportArchive();
    await context.request('/api/chats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Will be removed', model: 'gpt-4o' }),
    });
    expect(((await (await context.request('/api/chats')).json()) as { items: unknown[] }).items).toHaveLength(2);

    const response = await importArchive(bytes, 'replace', PASSPHRASE);
    expect(response.status).toBe(200);

    const chats = ((await (await context.request('/api/chats')).json()) as { items: Array<{ title: string }> }).items;
    expect(chats).toHaveLength(1);
    expect(chats[0].title).toBe('Archive chat');

    const providers = ((await (await context.request('/api/providers')).json()) as {
      providers: Array<{ name: string; hasApiKey: boolean }>;
    }).providers;
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ name: 'Archive OpenAI', hasApiKey: true });
  });

  it('rejects a bad passphrase, a missing mode, and an invalid archive', async () => {
    await seed(context);
    const { bytes } = await exportArchive();
    const wrong = await importArchive(bytes, 'merge', 'not the right passphrase');
    expect(wrong.status).toBe(400);
    expect(((await wrong.json()) as { code: string }).code).toBe('INVALID_ARCHIVE');

    const noMode = await importArchive(bytes, '', PASSPHRASE);
    expect(noMode.status).toBe(400);
    expect(((await noMode.json()) as { code: string }).code).toBe('INVALID_REQUEST');

    const invalid = await importArchive('not an archive', 'merge');
    expect(invalid.status).toBe(400);
  });
});

describe('external attachment storage', () => {
  it('exports and re-imports encrypted external files', async () => {
    await switchContext({ env: { storage: 'filesystem' } });
    const seeded = await seed(context);

    const direct = await context.request(`/api/files/${seeded.fileId}`);
    expect(direct.status).toBe(200);
    expect(await direct.text()).toBe(FILE_BYTES);

    const { bytes } = await exportArchive();
    const response = await importArchive(bytes, 'merge', PASSPHRASE);
    expect(response.status).toBe(200);

    const chats = ((await (await context.request('/api/chats')).json()) as {
      items: Array<{ id: string; title: string }>;
    }).items;
    const imported = chats.find((chat) => chat.id !== seeded.chatId);
    expect(imported).toBeTruthy();
    const messages = ((await (await context.request(`/api/chats/${imported!.id}/messages`)).json()) as {
      items: Array<{ role: string }>;
    }).items;
    expect(messages).toHaveLength(2);

    const files = await context.db.client.execute(
      "SELECT id FROM attachments WHERE message_id IS NOT NULL AND id != ?",
      [seeded.fileId],
    );
    expect(files.rows).toHaveLength(1);
    const importedFile = await context.request(`/api/files/${String(files.rows[0].id)}`);
    expect(importedFile.status).toBe(200);
    expect(await importedFile.text()).toBe(FILE_BYTES);
  });

  it('disables uploads when S3 storage is selected without configuration', async () => {
    await switchContext({ env: { storage: 's3', s3: undefined } });
    const form = new FormData();
    form.set('file', new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    const response = await context.request('/api/files', { method: 'POST', body: form });
    expect(response.status).toBe(503);
    const payload = (await response.json()) as { code: string; error: string };
    expect(payload.code).toBe('STORAGE_UNAVAILABLE');
    expect(payload.error).toContain('S3_BUCKET');
  });
});
