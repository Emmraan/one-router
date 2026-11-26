import { migrate, openDatabase, resolveMasterKey, seedOwner, type Database } from '@one-router/db';
import type { ServerEnv } from './env';

export interface BootstrapResult {
  db: Database;
  seeded: Awaited<ReturnType<typeof seedOwner>>;
}

export async function bootstrapDatabase(env: ServerEnv): Promise<BootstrapResult> {
  const key = await resolveMasterKey({
    value: env.encryptionKey,
    dataDir: env.dataDir,
    production: env.production,
  });
  const db = await openDatabase({
    url: env.databaseUrl,
    authToken: env.databaseAuthToken,
    key,
  });
  try {
    await migrate(db);
    const seeded = await seedOwner(db, { password: env.initialPassword });
    return { db, seeded };
  } catch (error) {
    db.close();
    throw error;
  }
}
