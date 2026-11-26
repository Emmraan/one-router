import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openDatabase, type Database } from '../client';
import { migrate } from '../migrate';
import { seedOwner } from '../seed';
import { createRepositories } from '../repositories/repositories';
import { decodeArchive, encodeArchive } from './format';
import { exportArchive, exportPlaintext, importArchive, previewArchive } from './transfer';
import { removeTestDatabase } from '../test-database';

let directory: string;
let source: Database;
let target: Database;
let owner: string;
let targetOwner: string;
const passphrase = 'correct archive passphrase';
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'one-router-archive-'));
  source = await openDatabase({ url: `file:${join(directory, 'test.db').replaceAll('\\', '/')}`, key: randomBytes(32) });
  // One file per suite also checks restore with a different owner and master key.
  await migrate(source);
  owner = (await seedOwner(source, { password: 'archive bootstrap password' })).user.id;
  const repos = createRepositories(source);
  await repos.providers.create(owner, { id: 'p', name: 'Private provider', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-archive-key', models: ['test'], isActive: true });
  await repos.chats.create(owner, { id: 'c', title: 'Portable private chat', providerId: 'p', model: 'test' });
  const file = await repos.attachments.create(owner, { name: 'notes.txt', mimeType: 'text/plain', bytes: Buffer.from('portable attachment') });
  await repos.messages.append(owner, 'c', { id: 'm', role: 'user', content: 'Portable private message', attachmentIds: [file.id] });
  await repos.settings.set(owner, 'theme', 'dark');
}, 15000);
afterAll(async () => {
  source?.close();
  target?.close();
  if (directory) await removeTestDatabase(directory);
});

it('authenticates the manifest and data, hides keys, and previews without writing', async () => {
  const bytes = await exportArchive(source, owner, { passphrase });
  expect(bytes.includes(Buffer.from('sk-archive-key'))).toBe(false);
  expect(bytes.includes(Buffer.from('Portable private'))).toBe(false);
  expect((await previewArchive(bytes, passphrase)).counts).toMatchObject({ chats: 1, messages: 1, providers: 1, attachments: 1 });
  await expect(previewArchive(bytes, 'wrong passphrase')).rejects.toThrow('archive');
  const changed = Buffer.from(bytes);
  changed[changed.length - 1] ^= 1;
  await expect(previewArchive(changed, passphrase)).rejects.toThrow('archive');
  await expect(previewArchive(bytes.subarray(0, 20), passphrase)).rejects.toThrow('archive');
}, 15000);

it('merges with fresh IDs and re-encrypts every field under the target master key', async () => {
  const bytes = await exportArchive(source, owner, { passphrase });
  // Reopen the same suite file under a different key after reading the encrypted backup.
  source.close();
  target = await openDatabase({ url: `file:${join(directory, 'test.db').replaceAll('\\', '/')}`, key: randomBytes(32) });
  await target.client.execute('DELETE FROM users');
  targetOwner = (await seedOwner(target, { password: 'target bootstrap password' })).user.id;
  const result = await importArchive(target, targetOwner, bytes, { passphrase, mode: 'merge' });
  expect(result.idMap.chats.c).not.toBe('c');
  const repos = createRepositories(target);
  const chat = (await repos.chats.list(targetOwner)).items[0];
  expect(chat.title).toBe('Portable private chat');
  expect((await repos.messages.list(targetOwner, chat.id)).items[0].content).toBe('Portable private message');
  expect((await repos.providers.resolve(targetOwner, result.idMap.providers.p))?.apiKey).toBe('sk-archive-key');
  const files = await target.client.execute('SELECT id FROM attachments');
  expect(await repos.attachments.read(targetOwner, files.rows[0].id as string)).toEqual(Buffer.from('portable attachment'));
  expect(await repos.settings.get(targetOwner)).toEqual({ theme: 'dark' });
}, 15000);

it('replaces transactionally and rejects invalid references before changing data', async () => {
  const bytes = await exportArchive(target, targetOwner, { passphrase });
  const decoded = await decodeArchive(bytes, passphrase);
  decoded.data.messages[0].chatId = 'missing-chat';
  await expect(encodeArchive(decoded.data, passphrase)).rejects.toThrow('archive');
  const before = (await target.client.execute('SELECT id FROM chats')).rows;
  await expect(importArchive(target, targetOwner, Buffer.from('not an archive'), { passphrase, mode: 'replace' })).rejects.toThrow('archive');
  expect((await target.client.execute('SELECT id FROM chats')).rows).toEqual(before);
  await importArchive(target, targetOwner, bytes, { passphrase, mode: 'replace' });
  expect((await createRepositories(target).chats.list(targetOwner)).items).toHaveLength(1);
}, 15000);

it('exports optional plaintext without provider keys and rejects injected plaintext keys', async () => {
  const plaintext = await exportPlaintext(target, targetOwner);
  expect(plaintext).not.toContain('sk-archive-key');
  const parsed = JSON.parse(plaintext);
  expect(parsed.data.providers[0].apiKey).toBeUndefined();
  parsed.data.providers[0].apiKey = 'plaintext-secret';
  await expect(importArchive(target, targetOwner, Buffer.from(JSON.stringify(parsed)), { mode: 'merge' })).rejects.toThrow('plaintext');
});
