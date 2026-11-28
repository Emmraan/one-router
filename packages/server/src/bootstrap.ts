import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { migrate, openDatabase, resolveMasterKey, seedOwner, type Database } from '@one-router/db';
import type { ServerEnv } from './env';

export interface BootstrapResult {
  db: Database;
  seeded: Awaited<ReturnType<typeof seedOwner>>;
}

export async function bootstrapDatabase(env: ServerEnv, options: { requireInitialPassword?: boolean } = {}): Promise<BootstrapResult> {
  let requireExistingKey = env.production;
  if (env.production && env.allowLocalKeyCreation && !env.encryptionKey) {
    // A new key cannot recover an existing encrypted database.
    await lstat(join(env.dataDir, 'one-router.db')).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      requireExistingKey = false;
    });
  }
  const key = await resolveMasterKey({
    value: env.encryptionKey,
    dataDir: env.dataDir,
    production: requireExistingKey,
  });
  const db = await openDatabase({
    url: env.databaseUrl,
    authToken: env.databaseAuthToken,
    key,
  });
  try {
    await migrate(db);
    const seeded = await seedOwner(db, { password: env.initialPassword, requirePassword: options.requireInitialPassword });
    return { db, seeded };
  } catch (error) {
    db.close();
    throw error;
  }
}
