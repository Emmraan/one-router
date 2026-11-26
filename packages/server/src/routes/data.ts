import { Hono } from 'hono';
import { exportArchive, exportPlaintext, importArchive, previewArchive, type Database } from '@one-router/db';
import { z } from 'zod';
import { HttpError } from '../errors';
import type { createFileStore } from '../files/storage';
import { readForm, readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { repositoryFailure } from './errors';

const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const exportSchema = z.object({
  passphrase: z.string().min(12).max(1024).optional(),
  plaintext: z.boolean().optional(),
}).strict();
const modeSchema = z.enum(['merge', 'replace']);

function importFailure(error: unknown): never {
  if (error instanceof Error && /archive/i.test(error.message)) {
    throw new HttpError(400, 'Unable to read archive; check the passphrase and file', 'INVALID_ARCHIVE');
  }
  return repositoryFailure(error);
}

function archiveFile(form: FormData): Promise<Uint8Array> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'Archive file is required', 'INVALID_ARCHIVE');
  if (file.size > MAX_ARCHIVE_BYTES + 1024) throw new HttpError(413, 'Archive is too large', 'PAYLOAD_TOO_LARGE');
  return file.arrayBuffer().then((bytes) => new Uint8Array(bytes));
}

function passphraseField(form: FormData): string | undefined {
  const value = form.get('passphrase');
  if (value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 1024) {
    throw new HttpError(400, 'Invalid passphrase', 'INVALID_PASSPHRASE');
  }
  return value;
}

export function dataRoutes(deps: {
  db: Database;
  auth: ReturnType<typeof createAuth>;
  fileStore: ReturnType<typeof createFileStore>;
  now: () => number;
}) {
  const app = new Hono<AppEnv>();
  const readAttachment = async (owner: string, file: { id: string; storage: string; objectKey: string | null }) =>
    deps.fileStore.readObject(owner, file.id, file.storage, file.objectKey);

  app.post('/export', async (c) => {
    const body = await readJson(c, exportSchema, 16 * 1024);
    const owner = c.get('ownerId');
    if (body.passphrase && body.plaintext) {
      throw new HttpError(400, 'Choose encrypted or plaintext export, not both', 'INVALID_REQUEST');
    }
    const date = new Date(deps.now()).toISOString().slice(0, 10);
    try {
      if (body.plaintext || !body.passphrase) {
        const text = await exportPlaintext(deps.db, owner, {
          readAttachment: (file) => readAttachment(owner, file),
        });
        return c.body(text, 200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="one-router-${date}.json"`,
          'Cache-Control': 'no-store',
        });
      }
      const bytes = await exportArchive(deps.db, owner, {
        passphrase: body.passphrase,
        now: deps.now(),
        readAttachment: (file) => readAttachment(owner, file),
      });
      return c.body(new Uint8Array(bytes), 200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="one-router-${date}.onerouter"`,
        'Cache-Control': 'no-store',
      });
    } catch (error) {
      return repositoryFailure(error);
    }
  });

  app.post('/preview', async (c) => {
    const form = await readForm(c, MAX_ARCHIVE_BYTES + 2 * 1024 * 1024);
    const bytes = await archiveFile(form);
    try {
      return c.json({ manifest: await previewArchive(bytes, passphraseField(form)) });
    } catch {
      throw new HttpError(400, 'Unable to read archive; check the passphrase and file', 'INVALID_ARCHIVE');
    }
  });

  app.post('/import', async (c) => {
    const form = await readForm(c, MAX_ARCHIVE_BYTES + 2 * 1024 * 1024);
    const bytes = await archiveFile(form);
    const mode = modeSchema.safeParse(form.get('mode'));
    if (!mode.success) throw new HttpError(400, 'Import mode must be merge or replace', 'INVALID_REQUEST');
    const owner = c.get('ownerId');
    try {
      const result = await importArchive(deps.db, owner, bytes, {
        mode: mode.data,
        passphrase: passphraseField(form),
      });
      await deps.fileStore.deleteObjects(owner, result.externalAttachments);
      return c.json({ manifest: result.manifest, imported: result.manifest.counts });
    } catch (error) {
      return importFailure(error);
    }
  });

  return app;
}
