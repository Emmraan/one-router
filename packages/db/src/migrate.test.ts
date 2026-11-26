import { copyFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { openDatabase, type Database } from './client';
import { migrate } from './migrate';
import { seedOwner } from './seed';
import { removeTestDatabase } from './test-database';

let directory: string;
let db: Database;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'one-router-migrate-'));
  db = await openDatabase({ url: `file:${join(directory, 'test.db').replaceAll('\\', '/')}`, key: Buffer.alloc(32, 1) });
});
afterAll(async () => {
  db?.close();
  if (directory) await removeTestDatabase(directory);
});

it('applies the initial migration exactly once with all required tables', async () => {
  await migrate(db);
  await migrate(db);
  const tables = await db.client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  expect(tables.rows.map((row) => row.name)).toEqual(expect.arrayContaining([
    'users', 'sessions', 'providers', 'chats', 'messages', 'attachments', 'settings', 'migrations',
  ]));
  expect((await db.client.execute('SELECT * FROM migrations')).rows).toHaveLength(1);
  expect((await db.client.execute('PRAGMA foreign_keys')).rows[0].foreign_keys).toBe(1);
});

it('seeds once and ignores INITIAL_PASSWORD after bootstrap', async () => {
  const first = await seedOwner(db, { password: 'original bootstrap password' });
  const second = await seedOwner(db, { password: 'different bootstrap password' });
  expect(first.created).toBe(true);
  expect(first.user.mustChangePassword).toBe(true);
  expect(first.password).toBe('original bootstrap password');
  expect(second.created).toBe(false);
  expect(second.password).toBeUndefined();
  expect(second.user.id).toBe(first.user.id);
  expect((await db.client.execute('SELECT id FROM users')).rows).toHaveLength(1);
}, 15000);

it('rolls back a broken additive migration and never records success', async () => {
  const { mkdir } = await import('node:fs/promises');
  const migrations = join(directory, 'broken');
  await mkdir(migrations);
  await copyFile(new URL('./migrations/0000_initial.sql', import.meta.url), join(migrations, '0000_initial.sql'));
  await writeFile(join(migrations, '0001_broken.sql'), 'CREATE TABLE rollback_probe (id TEXT);\n--> statement-breakpoint\nINVALID SQL;');
  await expect(migrate(db, { directory: migrations })).rejects.toThrow('migration');
  expect((await db.client.execute("SELECT name FROM sqlite_master WHERE name = 'rollback_probe'")).rows).toHaveLength(0);
  expect((await db.client.execute('SELECT * FROM migrations')).rows).toHaveLength(1);
});

it('refuses a missing or modified applied migration before applying new work', async () => {
  const { mkdir } = await import('node:fs/promises');
  const migrations = join(directory, 'incomplete');
  await mkdir(migrations);
  await writeFile(join(migrations, '0001_new.sql'), 'CREATE TABLE unexpected_upgrade (id TEXT);');
  await expect(migrate(db, { directory: migrations })).rejects.toThrow('migration');
  expect((await db.client.execute("SELECT name FROM sqlite_master WHERE name = 'unexpected_upgrade'")).rows).toHaveLength(0);
  await writeFile(join(migrations, '0000_initial.sql'), 'CREATE TABLE modified_history (id TEXT);');
  await expect(migrate(db, { directory: migrations })).rejects.toThrow('migration');
  expect((await db.client.execute("SELECT name FROM sqlite_master WHERE name = 'modified_history'")).rows).toHaveLength(0);
});
