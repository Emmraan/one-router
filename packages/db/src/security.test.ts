import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openDatabase, type Database } from './client';
import { migrate } from './migrate';
import { seedOwner } from './seed';
import { createRepositories } from './repositories/repositories';
import { exportArchive, exportPlaintext, importArchive, previewArchive } from './archive/transfer';
import { removeTestDatabase } from './test-database';
import { searchChats } from './search';

let directory: string;
let db: Database;
let owner: string;
let repos: ReturnType<typeof createRepositories>;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'one-router-security-'));
  db = await openDatabase({ url: `file:${join(directory, 'test.db').replaceAll('\\', '/')}`, key: randomBytes(32) });
  await migrate(db);
  owner = (await seedOwner(db, { password: 'security bootstrap password' })).user.id;
  repos = createRepositories(db);
  await db.client.execute({ sql: "INSERT INTO users (id, role, password_hash, created_at, updated_at) SELECT 'other', 'future-user', password_hash, 0, 0 FROM users WHERE id = ?", args: [owner] });
  await repos.chats.create(owner, { id: 'private', title: 'private title', model: 'test' });
}, 15000);
afterAll(async () => { db?.close(); if (directory) await removeTestDatabase(directory); });

it('enforces ownership in SQL foreign keys and transactional attachment linking', async () => {
  const provider = await repos.providers.create('other', { id: 'foreign-provider', name: 'Other provider', type: 'openai', baseUrl: 'https://api.openai.com/v1' });
  await expect(repos.chats.create(owner, { title: 'illegal reference', model: 'test', providerId: provider.id })).rejects.toThrow();
  await repos.chats.create('other', { id: 'foreign-chat', title: 'other private title', model: 'test' });
  await expect(repos.messages.append(owner, 'foreign-chat', { role: 'user', content: 'illegal message' })).rejects.toThrow('Chat');
  const file = await repos.attachments.create('other', { name: 'other.txt', mimeType: 'text/plain', bytes: Buffer.from('other private bytes') });
  await expect(repos.messages.append(owner, 'private', { id: 'cross-owner', role: 'user', content: 'illegal link', attachmentIds: [file.id] })).rejects.toThrow('Attachment');
  expect(await repos.messages.get(owner, 'cross-owner')).toBeNull();
  await repos.chats.permanentlyDelete(owner, 'foreign-chat');
  expect(await repos.chats.get('other', 'foreign-chat')).not.toBeNull();
});

it('authenticates ciphertext against its owner and row instead of allowing ciphertext swaps', async () => {
  const original = (await db.client.execute("SELECT title FROM chats WHERE id = 'private'")).rows[0].title;
  const foreign = (await db.client.execute("SELECT title FROM chats WHERE id = 'foreign-chat'")).rows[0].title;
  await db.client.execute({ sql: "UPDATE chats SET title = ? WHERE id = 'private'", args: [foreign] });
  await expect(repos.chats.get(owner, 'private')).rejects.toThrow('decrypt');
  await db.client.execute({ sql: "UPDATE chats SET title = ? WHERE id = 'private'", args: [original] });
});

it('rejects oversized inputs and forged or expired sessions without exposing secrets', async () => {
  await expect(repos.messages.append(owner, 'private', { role: 'user', content: 'x'.repeat(100001) })).rejects.toThrow();
  await expect(repos.attachments.create(owner, { name: 'large.txt', mimeType: 'text/plain', bytes: Buffer.alloc(10 * 1024 * 1024 + 1) })).rejects.toThrow();
  await expect(repos.settings.set(owner, '__proto__', { polluted: true })).rejects.toThrow('key');
  const session = await repos.sessions.create(owner, { now: 10, ttlMs: 10 });
  await repos.sessions.touch(session.token, { now: 20 });
  expect(await repos.sessions.find(session.token, { now: 21 })).toBeNull();
  expect(await repos.sessions.find('forged-token')).toBeNull();
  expect(await repos.users.verifyPassword(owner, 'wrong password')).toBe(false);
});

it('rejects control characters in identifiers before writing and supports maximum-length valid IDs', async () => {
  const before = (await db.client.execute('SELECT id FROM chats')).rows;
  await expect(repos.chats.create(owner, { id: '\u0000'.repeat(200), title: 'Invalid identifier', model: 'test' })).rejects.toThrow('identifier');
  expect((await db.client.execute('SELECT id FROM chats')).rows).toEqual(before);
  const id = 'a'.repeat(200);
  await repos.chats.create(owner, { id, title: 'Long identifier', model: 'test' });
  await repos.messages.append(owner, id, { role: 'user', content: 'first' });
  await repos.messages.append(owner, id, { role: 'assistant', content: 'second' });
  const page = await repos.messages.list(owner, id, { limit: 1 });
  expect((await repos.messages.list(owner, id, { limit: 1, cursor: page.nextCursor! })).items[0].content).toBe('second');
});

it('rolls back replace after a real SQL failure and preserves credentials and other owners', async () => {
  const passphrase = 'rollback archive passphrase';
  const bytes = await exportArchive(db, owner, { passphrase });
  const before = (await db.client.execute('SELECT id, title FROM chats ORDER BY id')).rows;
  const session = await repos.sessions.create(owner);
  await db.client.execute("CREATE TRIGGER fail_import BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
  try { await expect(importArchive(db, owner, bytes, { passphrase, mode: 'replace' })).rejects.toThrow(); }
  finally { await db.client.execute('DROP TRIGGER fail_import'); }
  expect((await db.client.execute('SELECT id, title FROM chats ORDER BY id')).rows).toEqual(before);
  expect(await repos.sessions.find(session.token)).toMatchObject({ userId: owner });
  expect((await repos.chats.get('other', 'foreign-chat'))?.title).toBe('other private title');
}, 15000);

it('round-trips credential-free plaintext and refuses header credentials and unsupported manifests', async () => {
  const plaintext = await exportPlaintext(db, owner);
  expect((await previewArchive(Buffer.from(plaintext))).version).toBe(1);
  await importArchive(db, owner, Buffer.from(plaintext), { mode: 'merge' });
  const parsed = JSON.parse(plaintext);
  parsed.manifest.version = 999;
  await expect(previewArchive(Buffer.from(JSON.stringify(parsed)))).rejects.toThrow('archive');
  parsed.manifest.version = 1;
  parsed.data.providers.push({ id: 'header-injection', customHeaders: { Authorization: 'private-token' } });
  await expect(importArchive(db, owner, Buffer.from(JSON.stringify(parsed)), { mode: 'replace' })).rejects.toThrow('plaintext');
});

it('supports cancellation and binds search cursors to the query and trash filter', async () => {
  await expect(searchChats(db, owner, 'private', { signal: AbortSignal.abort() })).rejects.toThrow();
  const first = await searchChats(db, owner, 'identifier', { limit: 1 });
  await expect(searchChats(db, owner, 'another', { cursor: first.nextCursor! })).rejects.toThrow('cursor');
  await expect(searchChats(db, owner, 'identifier', { cursor: first.nextCursor!, trash: true })).rejects.toThrow('cursor');
});
