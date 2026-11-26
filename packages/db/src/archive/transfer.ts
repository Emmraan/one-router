import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { atomic, type Store } from '../client';
import { decryptBytes, encryptBytes } from '../crypto/encryption';
import { attachments, chats, messages, providers, settings, users } from '../schema/tables';
import { decodeChat } from '../repositories/chats';
import { fieldContext, seal, unseal } from '../repositories/codec';
import { decodeMessage } from '../repositories/messages';
import { archiveDocument, decodeArchive, decodePlaintext, encodeArchive, isEncryptedArchive } from './format';
import { MAX_ARCHIVE_BYTES, type ArchiveData } from './schema';

type ExternalFile = { id: string; storage: 'filesystem' | 's3'; objectKey: string; size: number };
type ExportOptions = { readAttachment?: (file: ExternalFile) => Promise<Uint8Array> };
type ExternalAttachment = { id: string; storage: 'filesystem' | 's3'; objectKey: string };

const serializedBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value) ?? '') + 1;

async function snapshot(store: Store, owner: string, options: ExportOptions): Promise<ArchiveData> {
  return atomic(store, async (tx) => {
    const [user] = await tx.orm.select().from(users).where(eq(users.id, owner)).limit(1);
    if (!user) throw new Error('Archive owner not found');
    const counts = await Promise.all([
      tx.orm.select({ count: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(length(config)), 0)` }).from(providers).where(eq(providers.userId, owner)),
      tx.orm.select({ count: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(length(title)), 0)` }).from(chats).where(eq(chats.userId, owner)),
      tx.orm.select({ count: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(length(content)), 0)` }).from(messages).where(eq(messages.userId, owner)),
      tx.orm.select({ count: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(size), 0)` }).from(attachments).where(and(eq(attachments.userId, owner), isNotNull(attachments.messageId))),
      tx.orm.select({ count: sql<number>`count(*)`, bytes: sql<number>`coalesce(sum(length(value)), 0)` }).from(settings).where(eq(settings.userId, owner)),
    ]);
    const [providerCounts, chatCounts, messageCounts, fileCounts, settingCounts] = counts.map((result) => result[0]);
    const estimatedBytes = providerCounts.bytes + chatCounts.bytes + messageCounts.bytes + fileCounts.bytes * 4 / 3 + settingCounts.bytes + 1024 * 1024;
    if (providerCounts.count > 1000 || chatCounts.count > 10000 || messageCounts.count > 100000 || fileCounts.count > 100000 ||
      settingCounts.count > 1000 || estimatedBytes > MAX_ARCHIVE_BYTES - 31) throw new Error('Archive size or record limit exceeded');
    const providerRows = await tx.orm.select().from(providers).where(eq(providers.userId, owner)).orderBy(asc(providers.id)).limit(1001);
    const chatRows = await tx.orm.select().from(chats).where(eq(chats.userId, owner)).orderBy(asc(chats.id)).limit(10001);
    const preferenceRows = await tx.orm.select().from(settings).where(eq(settings.userId, owner)).orderBy(asc(settings.key)).limit(1001);
    const providerRecords = providerRows.map((row) => ({ ...JSON.parse(unseal(tx, owner, 'providers', row.id, 'config', row.config)), id: row.id,
      isActive: row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt }));
    const chatRecords = chatRows.map((row) => decodeChat(tx, row));
    const preferenceRecords = Object.fromEntries(preferenceRows.map((row) => [row.key, JSON.parse(unseal(tx, owner, 'settings', row.key, 'value', row.value))]));
    const profile = user.profile ? JSON.parse(unseal(tx, owner, 'users', owner, 'profile', user.profile)) : null;
    // Stored lengths miss JSON escaping after decryption, so charge every decoded record's serialized size.
    let documentBytes = 1024 * 1024;
    for (const record of providerRecords) documentBytes += serializedBytes(record);
    for (const record of chatRecords) documentBytes += serializedBytes(record);
    documentBytes += serializedBytes(preferenceRecords) + serializedBytes(profile);
    if (documentBytes > MAX_ARCHIVE_BYTES - 4096) throw new Error('Archive size exceeded');
    const messageRecords: ArchiveData['messages'] = [];
    for (let offset = 0; offset < messageCounts.count; offset += 50) {
      const batch = await tx.orm.select().from(messages).where(eq(messages.userId, owner))
        .orderBy(asc(messages.chatId), asc(messages.position), asc(messages.id)).limit(50).offset(offset);
      for (const row of batch) {
        const record = decodeMessage(tx, row);
        documentBytes += serializedBytes(record);
        if (documentBytes > MAX_ARCHIVE_BYTES - 4096) throw new Error('Archive size exceeded');
        messageRecords.push(record);
      }
    }
    const files: ArchiveData['attachments'] = [];
    for (let offset = 0; offset < fileCounts.count; offset += 5) {
      const batch = await tx.orm.select().from(attachments).where(and(eq(attachments.userId, owner), isNotNull(attachments.messageId)))
        .orderBy(asc(attachments.id)).limit(5).offset(offset);
      for (const file of batch) {
        let bytes: Uint8Array;
        if (file.storage === 'sqlite' && file.data) bytes = decryptBytes(file.data, tx.key, fieldContext(owner, 'attachments', file.id, 'data'));
        else {
          if (!options.readAttachment || file.storage === 'sqlite' || !file.objectKey) throw new Error('Archive requires an external attachment reader');
          bytes = await options.readAttachment({ id: file.id, storage: file.storage, objectKey: file.objectKey, size: file.size });
        }
        if (bytes.byteLength !== file.size) throw new Error('Archive attachment size mismatch');
        const record = { id: file.id, messageId: file.messageId!, name: unseal(tx, owner, 'attachments', file.id, 'name', file.name),
          mimeType: file.mimeType, size: file.size, data: Buffer.from(bytes).toString('base64'), createdAt: file.createdAt };
        documentBytes += serializedBytes(record);
        if (documentBytes > MAX_ARCHIVE_BYTES - 4096) throw new Error('Archive size exceeded');
        files.push(record);
      }
    }
    return { providers: providerRecords, chats: chatRecords, messages: messageRecords, attachments: files, settings: preferenceRecords, profile };
  });
}

export async function exportArchive(store: Store, owner: string, options: ExportOptions & { passphrase: string; now?: number }): Promise<Buffer> {
  return encodeArchive(await snapshot(store, owner, options), options.passphrase, options.now);
}

export async function exportPlaintext(store: Store, owner: string, options: ExportOptions = {}): Promise<string> {
  const data = await snapshot(store, owner, options);
  data.providers = data.providers.map(({ apiKey: _key, customHeaders: _headers, ...provider }) => provider);
  return JSON.stringify(archiveDocument(data));
}

export async function previewArchive(bytes: Uint8Array, passphrase?: string) {
  return (isEncryptedArchive(bytes) ? await decodeArchive(bytes, passphrase ?? '') : decodePlaintext(bytes)).manifest;
}

export async function importArchive(store: Store, owner: string, bytes: Uint8Array, options: { mode: 'merge' | 'replace'; passphrase?: string }) {
  if (!['merge', 'replace'].includes(options.mode)) throw new Error('Invalid archive import mode');
  const { manifest, data } = isEncryptedArchive(bytes) ? await decodeArchive(bytes, options.passphrase ?? '') : decodePlaintext(bytes);
  const maps = {
    providers: new Map(data.providers.map((row) => [row.id, randomUUID()])), chats: new Map(data.chats.map((row) => [row.id, randomUUID()])),
    messages: new Map(data.messages.map((row) => [row.id, randomUUID()])), attachments: new Map(data.attachments.map((row) => [row.id, randomUUID()])),
  };
  // Replace mode deletes external attachment metadata. Callers delete these objects only after this resolves.
  const externalAttachments: ExternalAttachment[] = [];
  await atomic(store, async (tx) => {
    const [user] = await tx.orm.select({ id: users.id }).from(users).where(eq(users.id, owner)).limit(1);
    if (!user) throw new Error('Archive owner not found');
    if (options.mode === 'replace') {
      for (let offset = 0; ; offset += 500) {
        const batch = await tx.orm.select({ id: attachments.id, storage: attachments.storage, objectKey: attachments.objectKey })
          .from(attachments).where(and(eq(attachments.userId, owner), isNotNull(attachments.objectKey)))
          .orderBy(asc(attachments.id)).limit(500).offset(offset);
        for (const row of batch) {
          if (row.objectKey && row.storage !== 'sqlite') externalAttachments.push({ id: row.id, storage: row.storage, objectKey: row.objectKey });
        }
        if (batch.length < 500) break;
      }
      await tx.orm.delete(chats).where(eq(chats.userId, owner));
      await tx.orm.delete(attachments).where(eq(attachments.userId, owner));
      await tx.orm.delete(providers).where(eq(providers.userId, owner));
      await tx.orm.delete(settings).where(eq(settings.userId, owner));
    }
    for (let offset = 0; offset < data.providers.length; offset += 25) {
      await tx.orm.insert(providers).values(data.providers.slice(offset, offset + 25).map((row) => {
        const id = maps.providers.get(row.id)!;
        const { createdAt, updatedAt, ...config } = row;
        return { id, userId: owner, type: row.type, isActive: row.isActive, createdAt, updatedAt,
          config: seal(tx, owner, 'providers', id, 'config', JSON.stringify({ ...config, id })) };
      }));
    }
    for (let offset = 0; offset < data.chats.length; offset += 25) {
      await tx.orm.insert(chats).values(data.chats.slice(offset, offset + 25).map((row) => {
        const id = maps.chats.get(row.id)!;
        return { ...row, id, userId: owner, providerId: row.providerId === null ? null : maps.providers.get(row.providerId)!, title: seal(tx, owner, 'chats', id, 'title', row.title) };
      }));
    }
    const orderedMessages = [...data.messages].sort((a, b) => a.chatId.localeCompare(b.chatId) || a.position - b.position || a.id.localeCompare(b.id));
    const normalizedPositions = new Map<string, number>();
    let previousChat = '';
    let nextPosition = 0;
    for (const row of orderedMessages) {
      if (row.chatId !== previousChat) { previousChat = row.chatId; nextPosition = 0; }
      normalizedPositions.set(row.id, nextPosition++);
    }
    for (let offset = 0; offset < orderedMessages.length; offset += 25) {
      await tx.orm.insert(messages).values(orderedMessages.slice(offset, offset + 25).map((row) => {
        const id = maps.messages.get(row.id)!;
        return { ...row, position: normalizedPositions.get(row.id)!, id, userId: owner,
          chatId: maps.chats.get(row.chatId)!, content: seal(tx, owner, 'messages', id, 'content', row.content) };
      }));
    }
    for (let offset = 0; offset < data.attachments.length; offset += 5) {
      await tx.orm.insert(attachments).values(data.attachments.slice(offset, offset + 5).map((row) => {
        const id = maps.attachments.get(row.id)!;
        return { id, userId: owner, messageId: maps.messages.get(row.messageId)!, name: seal(tx, owner, 'attachments', id, 'name', row.name),
          mimeType: row.mimeType, size: row.size, storage: 'sqlite' as const, createdAt: row.createdAt, expiresAt: null,
          data: encryptBytes(Buffer.from(row.data, 'base64'), tx.key, fieldContext(owner, 'attachments', id, 'data')) };
      }));
    }
    for (const [key, value] of Object.entries(data.settings)) {
      const encrypted = seal(tx, owner, 'settings', key, 'value', JSON.stringify(value));
      await tx.orm.insert(settings).values({ userId: owner, key, value: encrypted, updatedAt: Date.now() })
        .onConflictDoUpdate({ target: [settings.userId, settings.key], set: { value: encrypted, updatedAt: Date.now() } });
    }
    if (options.mode === 'replace' || data.profile !== null) {
      await tx.orm.update(users).set({ profile: data.profile === null ? null : seal(tx, owner, 'users', owner, 'profile', JSON.stringify(data.profile)), updatedAt: Date.now() }).where(eq(users.id, owner));
    }
  });
  return { manifest, idMap: { providers: Object.fromEntries(maps.providers), chats: Object.fromEntries(maps.chats),
    messages: Object.fromEntries(maps.messages), attachments: Object.fromEntries(maps.attachments) }, externalAttachments };
}
