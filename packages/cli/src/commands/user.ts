import { createRepositories, openDatabase, resolveMasterKey } from '@one-router/db';
import { CliError, type Command } from '../arguments';
import { runtimeConfig } from '../config';
import { passwordFromStdin, promptPassword } from '../prompt';

export async function resetPassword(command: Extract<Command, { command: 'reset-password' }>, version: string) {
  const { env } = await runtimeConfig(version);
  const password = await (command.stdin ? passwordFromStdin() : promptPassword());
  const key = await resolveMasterKey({ dataDir: env.dataDir, value: env.encryptionKey, production: true }).catch(() => {
    throw new CliError('Could not load the existing encryption key; check the data directory and key settings');
  });
  const db = await openDatabase({ url: env.databaseUrl, authToken: env.databaseAuthToken, key }).finally(() => key.fill(0));
  try {
    const users = createRepositories(db).users;
    const owner = await users.owner().catch(() => null);
    if (!owner) throw new CliError('No owner was found; check the database settings or run one-router init');
    await users.setPassword(owner.id, password, { forceChange: true });
    console.log('Owner password reset. Existing sessions were revoked. Change the password after next login.');
  } finally {
    db.close();
  }
}
