import { rm } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';

export async function removeTestDatabase(directory: string): Promise<void> {
  if (process.platform === 'win32') {
    // libSQL's native statements release Windows file handles in GC finalizers.
    if (!global.gc) throw new Error('Windows database tests require --expose-gc');
    await setImmediate();
    global.gc();
    await setImmediate();
    global.gc();
    await setImmediate();
  }
  await rm(directory, { recursive: true, force: true });
}
