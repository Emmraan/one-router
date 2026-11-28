import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Database } from './client';

export async function migrate(db: Database, options: { directory?: string } = {}): Promise<void> {
  const directory = options.directory ?? fileURLToPath(new URL('./migrations/', import.meta.url));
  try {
    await db.client.execute('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    const appliedRows = await db.client.execute('SELECT name FROM migrations');
    const appliedNames = new Set(appliedRows.rows.map((row) => String(row.name)));
    const files = (await readdir(directory)).filter((name) => /^\d{4}_[a-zA-Z0-9_]+\.sql$/.test(name)).sort();
    if (!files.length) throw new Error();
    if ([...appliedNames].some((name) => !files.includes(name))) throw new Error();
    for (const name of files) {
      const source = await readFile(join(directory, name), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const transaction = await db.client.transaction('write');
      try {
        const applied = await transaction.execute({ sql: 'SELECT checksum FROM migrations WHERE name = ?', args: [name] });
        if (applied.rows.length) {
          if (applied.rows[0].checksum !== checksum) {
            // The initial migration shipped in source checkouts before its line endings were pinned.
            const lf = source.replaceAll('\r\n', '\n');
            const otherLineEnding = source === lf ? lf.replaceAll('\n', '\r\n') : lf;
            const compatible = name === '0000_initial.sql'
              && applied.rows[0].checksum === createHash('sha256').update(otherLineEnding).digest('hex');
            if (!compatible) throw new Error();
          }
        } else {
          for (const statement of source.split('--> statement-breakpoint').map((sql) => sql.trim()).filter(Boolean)) {
            await transaction.execute(statement);
          }
          await transaction.execute({ sql: 'INSERT INTO migrations (name, checksum, applied_at) VALUES (?, ?, ?)', args: [name, checksum, Date.now()] });
        }
        await transaction.commit();
      } catch {
        await transaction.rollback();
        throw new Error();
      } finally {
        transaction.close();
      }
    }
  } catch {
    throw new Error('Database migration failed; startup must stop');
  }
}
