import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openDatabase, type Database } from '../client';
import { migrate } from '../migrate';
import { seedOwner } from '../seed';
import { createRepositories } from './repositories';
import { removeTestDatabase } from '../test-database';

let db: Database;
let directory: string;
let owner: string;
let repos: ReturnType<typeof createRepositories>;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'one-router-repos-'));
  db = await openDatabase({ url: `file:${join(directory, 'test.db').replaceAll('\\', '/')}`, key: randomBytes(32) });
  await migrate(db);
  owner = (await seedOwner(db, { password: 'bootstrap test password' })).user.id;
  repos = createRepositories(db);
}, 15000);
afterAll(async () => {
  db?.close();
  if (directory) await removeTestDatabase(directory);
});

it('encrypts provider secrets, masks normal reads, and scopes access to the owner', async () => {
  const provider = await repos.providers.create(owner, {
    id: 'provider', name: 'Personal endpoint', type: 'openai', baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test-very-private', models: ['gpt-test'], customHeaders: { 'X-Secret': 'header-private' }, isActive: true,
  });
  expect(provider.apiKey).not.toBe('sk-test-very-private');
  expect(provider.customHeaders).toBeUndefined();
  expect((await repos.providers.resolve(owner, provider.id))?.apiKey).toBe('sk-test-very-private');
  expect(await repos.providers.get('someone-else', provider.id)).toBeNull();
  const raw = JSON.stringify((await db.client.execute('SELECT * FROM providers')).rows);
  for (const secret of ['sk-test-very-private', 'Personal endpoint', 'header-private']) expect(raw).not.toContain(secret);
  await repos.providers.update(owner, provider.id, { name: 'Renamed endpoint' });
  expect((await repos.providers.resolve(owner, provider.id))?.apiKey).toBe('sk-test-very-private');
});

it('encrypts titles, messages, profile and preferences; preserves explicit ordering', async () => {
  await repos.users.updateProfile(owner, { displayName: 'Private owner' });
  expect((await repos.users.get(owner))?.profile).toEqual({ displayName: 'Private owner' });
  await repos.settings.set(owner, 'theme', 'dark');
  expect(await repos.settings.get(owner)).toEqual({ theme: 'dark' });
  await repos.chats.create(owner, { id: 'chat', title: 'Encrypted chat title', model: 'gpt-test', providerId: 'provider' });
  const first = await repos.messages.append(owner, 'chat', { role: 'user', content: 'private message A' });
  const second = await repos.messages.append(owner, 'chat', { role: 'assistant', content: 'private message B' });
  expect(second.position).toBe(first.position + 1);
  const page = await repos.messages.list(owner, 'chat', { limit: 1 });
  expect(page.items[0].id).toBe(first.id);
  expect((await repos.messages.list(owner, 'chat', { limit: 1, cursor: page.nextCursor! })).items[0].id).toBe(second.id);
  expect(await repos.messages.list('someone-else', 'chat')).toEqual({ items: [], nextCursor: null });
  for (const table of ['users', 'chats', 'messages', 'settings']) {
    const raw = JSON.stringify((await db.client.execute(`SELECT * FROM ${table}`)).rows);
    for (const secret of ['Private owner', 'Encrypted chat title', 'private message', '"dark"']) expect(raw).not.toContain(secret);
  }
});

it('honors manual titles, soft delete, restore and permanent cascade deletion', async () => {
  await repos.chats.rename(owner, 'chat', 'Manually chosen title');
  await repos.chats.rename(owner, 'chat', 'Automatic title', 'automatic');
  expect((await repos.chats.get(owner, 'chat'))?.title).toBe('Manually chosen title');
  await repos.chats.softDelete(owner, 'chat');
  expect((await repos.chats.list(owner)).items.map((chat) => chat.id)).not.toContain('chat');
  expect((await repos.chats.list(owner, { trash: true })).items[0].id).toBe('chat');
  await repos.chats.restore(owner, 'chat');
  expect((await repos.chats.get(owner, 'chat'))?.deletedAt).toBeNull();
});

it('keeps attachments encrypted, links them atomically, and cleans expired orphans', async () => {
  const bytes = Buffer.from('private attachment contents');
  const attachment = await repos.attachments.create(owner, { name: '../notes.txt', mimeType: 'text/plain', bytes });
  expect(attachment.name).toBe('notes.txt');
  expect(await repos.attachments.read(owner, attachment.id)).toEqual(bytes);
  expect(await repos.attachments.read('someone-else', attachment.id)).toBeNull();
  const raw = await db.client.execute('SELECT data FROM attachments WHERE id = ?', [attachment.id]);
  expect(Buffer.from(raw.rows[0].data as ArrayBuffer).includes(bytes)).toBe(false);
  await expect(repos.messages.append(owner, 'chat', {
    id: 'rollback-message', role: 'user', content: 'must roll back', attachmentIds: ['missing'],
  })).rejects.toThrow();
  expect((await db.client.execute("SELECT id FROM messages WHERE id = 'rollback-message'")).rows).toHaveLength(0);
  await repos.messages.append(owner, 'chat', { role: 'user', content: 'attached', attachmentIds: [attachment.id] });
  await repos.attachments.create(owner, { name: 'expired.txt', mimeType: 'text/plain', bytes, expiresAt: 1 });
  const cleaned = await repos.attachments.cleanup({ before: Date.now() });
  expect(cleaned).toHaveLength(1);
  expect(await repos.attachments.read(owner, attachment.id)).toEqual(bytes);
  await repos.chats.permanentlyDelete(owner, 'chat');
  expect((await db.client.execute("SELECT id FROM messages WHERE chat_id = 'chat'")).rows).toHaveLength(0);
  expect(await repos.attachments.get(owner, attachment.id)).toBeNull();
});

it('bounds pagination, handles tied timestamps and rejects untrusted cursors', async () => {
  for (const id of ['tied-a', 'tied-b', 'tied-c']) {
    await repos.chats.create(owner, { id, title: id, model: 'test', now: 100 });
  }
  const first = await repos.chats.list(owner, { limit: 2 });
  const second = await repos.chats.list(owner, { limit: 2, cursor: first.nextCursor! });
  expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3);
  await expect(repos.chats.list(owner, { limit: 100000 })).rejects.toThrow('limit');
  await expect(repos.chats.list(owner, { cursor: "'; DROP TABLE chats; --" })).rejects.toThrow('cursor');
  await expect(repos.chats.create(owner, { title: 'temporary', model: 'test', isTemporary: true })).rejects.toThrow('Temporary');
});

it('stores only session-token hashes, enforces expiry and revokes on password reset', async () => {
  const session = await repos.sessions.create(owner, { now: 100, ttlMs: 1000 });
  expect(await repos.sessions.find(session.token, { now: 200 })).toMatchObject({ userId: owner });
  expect(await repos.sessions.find(session.token, { now: 1100 })).toBeNull();
  const current = await repos.sessions.create(owner);
  expect(JSON.stringify((await db.client.execute('SELECT * FROM sessions')).rows)).not.toContain(current.token);
  await repos.users.setPassword(owner, 'new reset password value', { forceChange: true });
  expect(await repos.sessions.find(current.token)).toBeNull();
  expect((await repos.users.get(owner))?.mustChangePassword).toBe(true);
}, 15000);
