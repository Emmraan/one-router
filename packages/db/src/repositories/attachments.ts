import { randomUUID } from 'node:crypto';
import { validateAttachment } from '@one-router/core';
import { and, eq, isNull, lte } from 'drizzle-orm';
import type { Store } from '../client';
import { decryptBytes, encryptBytes } from '../crypto/encryption';
import { attachments } from '../schema/tables';
import { fieldContext, seal, unseal } from './codec';
import { idSchema, timeSchema } from './validation';

export function attachmentRepository(store: Store) {
  const get = async (owner: string, id: string) => {
    const [row] = await store.orm.select().from(attachments).where(and(eq(attachments.userId, owner), eq(attachments.id, id))).limit(1);
    if (!row || (row.expiresAt !== null && row.expiresAt <= Date.now())) return null;
    const { data: _data, userId: _userId, ...publicFile } = row;
    return { ...publicFile, name: unseal(store, owner, 'attachments', id, 'name', row.name) };
  };
  return {
    get,
    async create(owner: string, input: { id?: string; name: string; mimeType: string; bytes: Uint8Array; expiresAt?: number }) {
      const file = validateAttachment({ name: input.name, type: input.mimeType, bytes: input.bytes, maxBytes: 10 * 1024 * 1024 });
      const id = idSchema.parse(input.id ?? randomUUID());
      const now = Date.now();
      const expiresAt = timeSchema.parse(input.expiresAt ?? now + 86400000);
      await store.orm.insert(attachments).values({ id, userId: owner,
        name: seal(store, owner, 'attachments', id, 'name', file.name), mimeType: file.type, size: input.bytes.byteLength,
        storage: 'sqlite', data: encryptBytes(input.bytes, store.key, fieldContext(owner, 'attachments', id, 'data')), expiresAt, createdAt: now });
      // Expired uploads are permitted so cleanup can process recovered orphan metadata.
      return { id, name: file.name, mimeType: file.type, size: input.bytes.byteLength, expiresAt };
    },
    async read(owner: string, id: string): Promise<Buffer | null> {
      const [row] = await store.orm.select().from(attachments).where(and(eq(attachments.userId, owner), eq(attachments.id, id))).limit(1);
      if (!row || (row.expiresAt !== null && row.expiresAt <= Date.now())) return null;
      if (row.storage !== 'sqlite' || !row.data) throw new Error('Attachment requires an external storage adapter');
      return decryptBytes(row.data, store.key, fieldContext(owner, 'attachments', id, 'data'));
    },
    async delete(owner: string, id: string) {
      return store.orm.delete(attachments).where(and(eq(attachments.userId, owner), eq(attachments.id, id)))
        .returning({ id: attachments.id, storage: attachments.storage, objectKey: attachments.objectKey });
    },
    async cleanup(options: { before?: number } = {}) {
      return store.orm.delete(attachments).where(and(isNull(attachments.messageId), lte(attachments.expiresAt, timeSchema.parse(options.before ?? Date.now()))))
        .returning({ id: attachments.id, storage: attachments.storage, objectKey: attachments.objectKey });
    },
  };
}
