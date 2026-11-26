import { randomBytes } from 'node:crypto';
import { link, lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

function decodeKey(value: string): Buffer {
  const normalized = value.trim();
  const key = /^[a-fA-F0-9]{64}$/.test(normalized)
    ? Buffer.from(normalized, 'hex')
    : /^[A-Za-z0-9+/]{43}=$/.test(normalized) ? Buffer.from(normalized, 'base64') : null;
  if (!key || key.length !== 32) throw new Error('Invalid encryption key');
  return key;
}

async function readKey(path: string): Promise<Buffer> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || (process.platform !== 'win32' && (info.mode & 0o077) !== 0)) {
    throw new Error('Unsafe encryption key file permissions');
  }
  return decodeKey(await readFile(path, 'utf8'));
}

export async function resolveMasterKey(options: {
  value?: string; dataDir?: string; production?: boolean;
}): Promise<Buffer> {
  if (options.value !== undefined) return decodeKey(options.value);
  const dataDir = options.dataDir ?? join(homedir(), '.one-router');
  const path = join(dataDir, 'encryption.key');
  try {
    return await readKey(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (options.production) throw new Error('Missing production encryption key');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const temporary = join(dataDir, `.key-${randomBytes(16).toString('hex')}`);
  await writeFile(temporary, `${randomBytes(32).toString('base64')}\n`, { mode: 0o600, flag: 'wx' });
  try {
    // Publish a complete file atomically; concurrent bootstrap must never read a partial key.
    await link(temporary, path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  } finally {
    await unlink(temporary);
  }
  return readKey(path);
}
