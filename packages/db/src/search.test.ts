import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openDatabase, type Database } from './client';
import { migrate } from './migrate';
import { seedOwner } from './seed';
import { createRepositories } from './repositories/repositories';
import { searchChats } from './search';
import { removeTestDatabase } from './test-database';

let directory: string;
let db: Database;
let owner: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'one-router-search-'));
  db = await openDatabase({ url: `file:${join(directory, 'test.db').replaceAll('\\', '/')}`, key: Buffer.alloc(32, 3) });
  await migrate(db);
  owner = (await seedOwner(db, { password: 'search bootstrap password' })).user.id;
  const repos = createRepositories(db);
  for (let i = 0; i < 105; i++) {
    await repos.chats.create(owner, { id: `chat-${i}`, title: i === 104 ? 'Needle in title' : 'Other title', model: 'test', now: i });
  }
  await repos.messages.append(owner, 'chat-0', { role: 'user', content: 'A NEEDLE in encrypted messages' });
  await repos.messages.append(owner, 'chat-1', { role: 'user', content: 'needle in the trash' });
  await repos.chats.softDelete(owner, 'chat-1');
}, 15000);
afterAll(async () => {
  db?.close();
  if (directory) await removeTestDatabase(directory);
});

it('decrypts and filters titles and messages through multiple scan batches', async () => {
  const first = await searchChats(db, owner, 'needle', { limit: 1 });
  const second = await searchChats(db, owner, 'needle', { limit: 1, cursor: first.nextCursor! });
  expect(new Set([...first.items, ...second.items].map((chat) => chat.id))).toEqual(new Set(['chat-104', 'chat-0']));
  expect((await searchChats(db, 'other-owner', 'needle')).items).toEqual([]);
  expect((await searchChats(db, owner, "' OR 1=1 --")).items).toEqual([]);
  expect((await searchChats(db, owner, 'needle', { trash: true })).items.map((chat) => chat.id)).toEqual(['chat-1']);
});

it('rejects oversized searches and does not expose ciphertext in search results', async () => {
  await expect(searchChats(db, owner, 'x'.repeat(201))).rejects.toThrow('query');
  const result = await searchChats(db, owner, 'needle');
  expect(result.items).toHaveLength(2);
  expect(JSON.stringify(result)).not.toContain('v1:');
});
