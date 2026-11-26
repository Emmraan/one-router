import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { validateAttachment, type FetchLike } from '@one-router/core';
import { createRepositories, type Database } from '@one-router/db';
import { maxUploadBytes, type ServerEnv } from '../env';
import { HttpError } from '../errors';
import { createFilesystemStorage, type ObjectStorage } from './filesystem';
import { createS3Storage } from './s3';

export interface StoredAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  expiresAt: number;
}

type AttachmentRow = NonNullable<Awaited<ReturnType<ReturnType<typeof createRepositories>['attachments']['get']>>>;
type ObjectRef = { id: string; storage: 'sqlite' | 'filesystem' | 's3'; objectKey: string | null };

export interface FileStore {
  enabled: boolean;
  guidance?: string;
  put(owner: string, input: { name: string; type: string; bytes: Uint8Array }): Promise<StoredAttachment>;
  read(owner: string, id: string): Promise<{ file: AttachmentRow; bytes: Buffer } | null>;
  delete(owner: string, id: string): Promise<boolean>;
  deleteObjects(owner: string, objects: ObjectRef[]): Promise<void>;
  readObject(owner: string, id: string, storage: string, objectKey: string | null): Promise<Uint8Array>;
}

function toStored(row: { id: string; name: string; mimeType: string; size: number; expiresAt: number | null }): StoredAttachment {
  return {
    id: row.id,
    name: row.name,
    type: row.mimeType,
    size: row.size,
    url: `/api/files/${row.id}`,
    expiresAt: row.expiresAt ?? 0,
  };
}

export function createFileStore(options: { db: Database; env: ServerEnv; fetch?: FetchLike }): FileStore {
  const repos = createRepositories(options.db);
  const adapter: ObjectStorage | null = options.env.storage === 'filesystem'
    ? createFilesystemStorage(join(options.env.dataDir, 'files'))
    : options.env.storage === 's3' && options.env.s3
      ? createS3Storage(options.env.s3, options.fetch)
      : null;
  const enabled = options.env.storage !== 's3' || adapter !== null;
  const guidance = enabled ? undefined :
    'File uploads are disabled. Configure S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.';

  const deleteObjects = async (_owner: string, objects: ObjectRef[]) => {
    if (!adapter) return;
    for (const object of objects) {
      if (object.storage === 'sqlite' || !object.objectKey) continue;
      try {
        await adapter.delete(object.objectKey);
      } catch {
        // Metadata is already gone; a failed object delete must not undo the request.
      }
    }
  };

  return {
    enabled,
    guidance,
    async put(owner, input) {
      if (!enabled) throw new HttpError(503, guidance!, 'STORAGE_UNAVAILABLE');
      const file = validateAttachment({
        name: input.name,
        type: input.type,
        bytes: input.bytes,
        maxBytes: maxUploadBytes(options.env),
      });
      const id = randomUUID();
      if (!adapter) {
        const row = await repos.attachments.create(owner, {
          id, name: file.name, mimeType: file.type, bytes: input.bytes,
        });
        return toStored(row);
      }
      const objectKey = randomUUID();
      const encrypted = repos.attachments.encrypt(owner, id, input.bytes);
      await adapter.put(objectKey, encrypted);
      try {
        const row = await repos.attachments.createExternal(owner, {
          id, name: file.name, mimeType: file.type, bytes: input.bytes,
          storage: options.env.storage as 'filesystem' | 's3', objectKey,
        });
        return toStored(row);
      } catch (error) {
        await adapter.delete(objectKey).catch(() => undefined);
        throw error;
      }
    },
    async read(owner, id) {
      const file = await repos.attachments.get(owner, id);
      if (!file) return null;
      let bytes: Uint8Array;
      if (file.storage === 'sqlite') {
        const stored = await repos.attachments.read(owner, id);
        if (!stored) return null;
        bytes = stored;
      } else {
        if (!adapter || !file.objectKey) throw new HttpError(503, 'File storage is unavailable', 'STORAGE_UNAVAILABLE');
        bytes = repos.attachments.decrypt(owner, id, await adapter.get(file.objectKey));
      }
      if (bytes.byteLength !== file.size) throw new Error('Stored file size mismatch');
      return { file, bytes: Buffer.from(bytes) };
    },
    async delete(owner, id) {
      const rows = await repos.attachments.delete(owner, id);
      await deleteObjects(owner, rows);
      return rows.length > 0;
    },
    deleteObjects,
    async readObject(owner, id, storage, objectKey) {
      if (storage === 'sqlite' || !objectKey || !adapter) throw new Error('External file storage is unavailable');
      return repos.attachments.decrypt(owner, id, await adapter.get(objectKey));
    },
  };
}
