import type { BootstrapResult, Logger } from '@one-router/server';

export const serverLogger: Logger = ({ level, requestId, status, code }) => {
  if (level === 'error') console.error(JSON.stringify({ level, requestId, status, code }));
};

export function reportBootstrap(seeded: BootstrapResult['seeded'], dataDir: string, supplied: boolean) {
  if (!seeded.created) return;
  console.log(`Data directory: ${dataDir}`);
  if (!supplied && seeded.password) console.log(`Bootstrap owner password (sensitive): ${seeded.password}`);
  console.log('The owner must change the password after first login. A generated password is shown only once.');
}
