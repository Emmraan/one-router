import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openDatabase, type Database } from '../client';
import { migrate } from '../migrate';
import { seedOwner } from '../seed';
import { createRepositories } from '../repositories/repositories';
import { seal } from '../repositories/codec';
import { attachments } from '../schema/tables';
import { removeTestDatabase } from '../test-database';
import { archiveDocument, encodeArchive } from './format';
import { exportArchive, exportPlaintext, importArchive, previewArchive } from './transfer';

let directory: string;
let db: Database;
let owner: string;
let repos: ReturnType<typeof createRepositories>;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'one-router-archive-security-'));
  db = await openDatabase({ url: `file:${join(directory, 'test.db').replaceAll('\\', '/')}`, key: randomBytes(32) });
  await migrate(db);
  owner = (await seedOwner(db, { password: 'archive security password' })).user.id;
  repos = createRepositories(db);
}, 15000);
afterAll(async () => { db?.close(); if (directory) await removeTestDatabase(directory); });

it('rejects an excessive aggregate attachment size before reading or decrypting any BLOB', async () => {
  await repos.chats.create(owner, { id: 'large', title: 'Large snapshot', model: 'test' });
  try {
    for (let i = 0; i < 7; i++) {
      const file = await repos.attachments.create(owner, { id: `large-file-${i}`, name: 'large.txt', mimeType: 'text/plain', bytes: Buffer.from('x') });
      await repos.messages.append(owner, 'large', { role: 'user', content: 'large upload', attachmentIds: [file.id] });
    }
    // Corrupt BLOBs must never be reached when metadata already exceeds the export budget.
    await db.client.execute("UPDATE attachments SET size = 10485760, data = zeroblob(1) WHERE id LIKE 'large-file-%'");
    await expect(exportPlaintext(db, owner)).rejects.toThrow('Archive size');
    await expect(exportArchive(db, owner, { passphrase: 'large snapshot passphrase' })).rejects.toThrow('Archive size');
  } finally { await repos.chats.permanentlyDelete(owner, 'large'); }
});

it('rejects a BLOB whose decrypted length disagrees with attachment metadata', async () => {
  await repos.chats.create(owner, { id: 'mismatch', title: 'Mismatched file', model: 'test' });
  try {
    const file = await repos.attachments.create(owner, { id: 'mismatched-file', name: 'small.txt', mimeType: 'text/plain', bytes: Buffer.from('x') });
    await repos.messages.append(owner, 'mismatch', { role: 'user', content: 'attached', attachmentIds: [file.id] });
    await db.client.execute("UPDATE attachments SET size = 2 WHERE id = 'mismatched-file'");
    await expect(exportPlaintext(db, owner)).rejects.toThrow('size mismatch');
  } finally { await repos.chats.permanentlyDelete(owner, 'mismatch'); }
});

it('rejects control-character message content whose escaped size exceeds the archive budget', async () => {
  await repos.chats.create(owner, { id: 'escaped', title: 'Escaped content', model: 'test' });
  try {
    // Stored ciphertext is base64, so the early estimate passes while JSON escaping expands each control character sixfold.
    for (let i = 0; i < 115; i++) await repos.messages.append(owner, 'escaped', { role: 'user', content: '\u0001'.repeat(100000) });
    await expect(exportPlaintext(db, owner)).rejects.toThrow('Archive size exceeded');
  } finally { await repos.chats.permanentlyDelete(owner, 'escaped'); }
}, 30000);

it('reports external attachment objects for cleanup after replace import commits', async () => {
  await repos.chats.create(owner, { id: 'external', title: 'External object', model: 'test' });
  let chatId = 'external';
  try {
    const message = await repos.messages.append(owner, 'external', { role: 'user', content: 'external object' });
    const { data } = JSON.parse(await exportPlaintext(db, owner));
    await db.orm.insert(attachments).values({ id: 'external-file', userId: owner, messageId: message.id,
      name: seal(db, owner, 'attachments', 'external-file', 'name', 'external.txt'), mimeType: 'text/plain', size: 4,
      storage: 'filesystem', objectKey: 'objects/external.txt', createdAt: Date.now() });
    const result = await importArchive(db, owner, Buffer.from(JSON.stringify(archiveDocument(data))), { mode: 'replace' });
    chatId = result.idMap.chats.external;
    expect(result.externalAttachments).toEqual([{ id: 'external-file', storage: 'filesystem', objectKey: 'objects/external.txt' }]);
    expect(await db.orm.select().from(attachments)).toEqual([]);
  } finally { await repos.chats.permanentlyDelete(owner, chatId); }
});

it('keeps external attachment metadata when replace import rolls back', async () => {
  await repos.chats.create(owner, { id: 'rollback', title: 'Rollback', model: 'test' });
  try {
    const message = await repos.messages.append(owner, 'rollback', { role: 'user', content: 'rollback' });
    const { data } = JSON.parse(await exportPlaintext(db, owner));
    await db.orm.insert(attachments).values({ id: 'rollback-file', userId: owner, messageId: message.id,
      name: seal(db, owner, 'attachments', 'rollback-file', 'name', 'rollback.txt'), mimeType: 'text/plain', size: 4,
      storage: 's3', objectKey: 'objects/rollback.txt', createdAt: Date.now() });
    data.settings.forcedRollback = true;
    await db.client.execute("CREATE TRIGGER rollback_guard BEFORE INSERT ON settings BEGIN SELECT RAISE(ABORT, 'forced import failure'); END");
    try {
      await expect(importArchive(db, owner, Buffer.from(JSON.stringify(archiveDocument(data))), { mode: 'replace' })).rejects.toThrow();
    } finally {
      await db.client.execute('DROP TRIGGER rollback_guard');
    }
    const rows = await db.orm.select().from(attachments).where(eq(attachments.id, 'rollback-file'));
    expect(rows).toHaveLength(1);
    expect(rows[0].objectKey).toBe('objects/rollback.txt');
  } finally { await repos.chats.permanentlyDelete(owner, 'rollback'); }
});

it('exports and validates a supported 10 MiB attachment without stack exhaustion', async () => {
  await repos.chats.create(owner, { id: 'maximum-file', title: 'Maximum file', model: 'test' });
  try {
    const file = await repos.attachments.create(owner, { name: 'maximum.txt', mimeType: 'text/plain', bytes: Buffer.alloc(10 * 1024 * 1024, 120) });
    await repos.messages.append(owner, 'maximum-file', { role: 'user', content: 'attached', attachmentIds: [file.id] });
    const plaintext = await exportPlaintext(db, owner);
    expect((await previewArchive(Buffer.from(plaintext))).counts.attachments).toBe(1);
    const bytes = await exportArchive(db, owner, { passphrase: 'maximum file passphrase' });
    expect((await previewArchive(bytes, 'maximum file passphrase')).counts.attachments).toBe(1);
  } finally { await repos.chats.permanentlyDelete(owner, 'maximum-file'); }
}, 20000);

it.each([
  'https://user:password@example.com/v1', 'https://example.com/v1?api_key=private',
  'https://example.com/v1#private', 'file:///private/key',
])('rejects credential-bearing or unsupported provider base URL %s', async (baseUrl) => {
  await expect(repos.providers.create(owner, { id: 'unsafe', name: 'Unsafe', type: 'openai', baseUrl })).rejects.toThrow();
  expect(await repos.providers.get(owner, 'unsafe')).toBeNull();
});

it('validates base URLs on update and archive import as well as provider creation', async () => {
  await repos.providers.create(owner, { id: 'safe', name: 'Safe', type: 'openai', baseUrl: 'https://example.com/v1' });
  await expect(repos.providers.update(owner, 'safe', { baseUrl: 'https://example.com/v1?key=private' })).rejects.toThrow();
  const parsed = JSON.parse(await exportPlaintext(db, owner));
  parsed.data.providers[0].baseUrl = 'https://user:password@example.com/v1';
  // Build a valid checksum so rejection depends on configuration validation.
  const { createHash } = await import('node:crypto');
  parsed.manifest.checksum = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
  await expect(importArchive(db, owner, Buffer.from(JSON.stringify(parsed)), { mode: 'replace' })).rejects.toThrow('archive');
  expect((await repos.providers.get(owner, 'safe'))?.baseUrl).toBe('https://example.com/v1');
});

it('normalizes imported message positions so a valid high position cannot disable appends', async () => {
  await repos.chats.create(owner, { id: 'positions', title: 'Position ordering', model: 'test' });
  await repos.messages.append(owner, 'positions', { role: 'user', content: 'first' });
  const { data } = JSON.parse(await exportPlaintext(db, owner));
  data.messages[0].position = 100000000;
  const result = await importArchive(db, owner, Buffer.from(JSON.stringify(archiveDocument(data))), { mode: 'replace' });
  const id = result.idMap.chats.positions;
  await repos.messages.append(owner, id, { role: 'assistant', content: 'second' });
  expect((await repos.messages.list(owner, id)).items.map((message) => message.position)).toEqual([0, 1]);
});

it('bounds the complete archive document before encryption, including large non-attachment fields', async () => {
  const data = JSON.parse(await exportPlaintext(db, owner)).data;
  data.chats.push({ id: 'large-field', providerId: null, title: 'x'.repeat(65 * 1024 * 1024), model: 'test',
    manualTitle: false, isPinned: false, createdAt: 0, updatedAt: 0, deletedAt: null });
  await expect(encodeArchive(data, 'large field archive password')).rejects.toThrow('archive');
});
