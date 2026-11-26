import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema/tables';

export type Database = {
  client: Client;
  orm: LibSQLDatabase<typeof schema>;
  key: Buffer;
  close: () => void;
};

type Transaction = Parameters<Parameters<Database['orm']['transaction']>[0]>[0];
export type Store = { orm: Database['orm'] | Transaction; key: Buffer; inTransaction?: boolean };

export async function atomic<T>(store: Store, operation: (transaction: Store) => Promise<T>): Promise<T> {
  if (store.inTransaction) return operation(store);
  return store.orm.transaction(async (orm) => operation({ orm, key: store.key, inTransaction: true }));
}

export async function openDatabase(options: { url: string; authToken?: string; key: Uint8Array }): Promise<Database> {
  if (options.key.byteLength !== 32) throw new Error('Invalid encryption key');
  if (!/^(file:|libsql:\/\/|https:\/\/|wss:\/\/)/.test(options.url)) throw new Error('Invalid database URL');
  let client: Client | undefined;
  try {
    client = createClient({ url: options.url, authToken: options.authToken });
    await client.execute('PRAGMA foreign_keys = ON');
    const key = Buffer.from(options.key);
    const connection = client;
    return { client, orm: drizzle(client, { schema }), key, close: () => { connection.close(); key.fill(0); } };
  } catch {
    client?.close();
    throw new Error('Unable to open database; check database configuration');
  }
}
