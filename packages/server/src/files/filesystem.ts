import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const keyPattern = /^[A-Za-z0-9._-]{1,200}$/;

export interface ObjectStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

export function createFilesystemStorage(root: string): ObjectStorage {
  const path = (key: string) => {
    if (!keyPattern.test(key)) throw new Error('Invalid storage key');
    return join(root, key);
  };
  return {
    async put(key, bytes) {
      await mkdir(root, { recursive: true, mode: 0o700 });
      await writeFile(path(key), bytes, { mode: 0o600, flag: 'wx' });
    },
    async get(key) {
      return readFile(path(key));
    },
    async delete(key) {
      try {
        await unlink(path(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    },
  };
}
