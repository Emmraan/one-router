import { Hono } from 'hono';
import type { ServerEnv } from '../env';
import { HttpError } from '../errors';
import { maxUploadBytes } from '../env';
import { readForm } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import type { createFileStore } from '../files/storage';
import type { AppEnv } from '../types';

const MEBIBYTE = 1024 * 1024;

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function fileRoutes(deps: {
  env: ServerEnv;
  auth: ReturnType<typeof createAuth>;
  fileStore: ReturnType<typeof createFileStore>;
}) {
  const app = new Hono<AppEnv>();

  app.post('/', async (c) => {
    if (!deps.fileStore.enabled) throw new HttpError(503, deps.fileStore.guidance!, 'STORAGE_UNAVAILABLE');
    const form = await readForm(c, Math.ceil(deps.env.maxTotalMb * MEBIBYTE) + 2 * MEBIBYTE);
    const uploads = [...form.getAll('file'), ...form.getAll('files')].filter((value): value is File => value instanceof File);
    if (uploads.length === 0) throw new HttpError(400, 'No files supplied', 'NO_FILES');
    if (uploads.length > deps.env.maxFiles) {
      throw new HttpError(400, `At most ${deps.env.maxFiles} files are allowed`, 'TOO_MANY_FILES');
    }

    const total = uploads.reduce((sum, file) => sum + file.size, 0);
    if (total > deps.env.maxTotalMb * MEBIBYTE) {
      throw new HttpError(400, `Files must total at most ${deps.env.maxTotalMb} MB`, 'TOTAL_TOO_LARGE');
    }
    for (const file of uploads) {
      if (file.size > maxUploadBytes(deps.env)) {
        throw new HttpError(400, `Each file must be at most ${maxUploadBytes(deps.env)} bytes`, 'FILE_TOO_LARGE');
      }
    }

    const stored: Awaited<ReturnType<typeof deps.fileStore.put>>[] = [];
    try {
      for (const file of uploads) {
        stored.push(await deps.fileStore.put(c.get('ownerId'), {
          name: file.name,
          type: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        }));
      }
    } catch (error) {
      for (const file of stored) await deps.fileStore.delete(c.get('ownerId'), file.id);
      throw error;
    }
    return c.json({ files: stored }, 201);
  });

  app.get('/:id', async (c) => {
    const result = await deps.fileStore.read(c.get('ownerId'), c.req.param('id'));
    if (!result) throw new HttpError(404, 'File not found', 'NOT_FOUND');
    c.header('Content-Type', result.file.mimeType);
    c.header('Content-Length', String(result.bytes.byteLength));
    c.header('Content-Disposition', contentDisposition(result.file.name));
    c.header('Cache-Control', 'private, no-store');
    return c.body(new Uint8Array(result.bytes));
  });

  app.delete('/:id', async (c) => {
    if (!(await deps.fileStore.delete(c.get('ownerId'), c.req.param('id')))) {
      throw new HttpError(404, 'File not found', 'NOT_FOUND');
    }
    return c.json({ ok: true });
  });

  return app;
}
