import { createHash } from 'node:crypto';
import { validateAttachment } from '@one-router/core';
import { z } from 'zod';
import { archiveProviderSchema, idSchema, modelSchema, settingKey, timeSchema, titleSchema, validateJson } from '../repositories/validation';

export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
export const archiveDataSchema = z.object({
  providers: z.array(archiveProviderSchema).max(1000),
  chats: z.array(z.object({
    id: idSchema, providerId: idSchema.nullable(), title: titleSchema, model: modelSchema,
    manualTitle: z.boolean(), isPinned: z.boolean(), createdAt: timeSchema, updatedAt: timeSchema, deletedAt: timeSchema.nullable(),
  }).strict()).max(10000),
  messages: z.array(z.object({
    id: idSchema, chatId: idSchema, role: z.enum(['user', 'assistant', 'system']), content: z.string().max(100000),
    model: modelSchema.nullable(), position: z.number().int().min(0).max(100000000), isRegenerated: z.boolean(), createdAt: timeSchema, updatedAt: timeSchema,
  }).strict()).max(100000),
  attachments: z.array(z.object({
    id: idSchema, messageId: idSchema, name: z.string().min(1).max(255), mimeType: z.string().min(1).max(200),
    size: z.number().int().min(1).max(10 * 1024 * 1024), data: z.string().max(14 * 1024 * 1024), createdAt: timeSchema,
  }).strict()).max(100000),
  settings: z.record(z.string(), z.unknown()),
  profile: z.record(z.string(), z.unknown()).nullable(),
}).strict();
export type ArchiveData = z.infer<typeof archiveDataSchema>;

export function archiveCounts(data: ArchiveData) {
  return { providers: data.providers.length, chats: data.chats.length, messages: data.messages.length,
    attachments: data.attachments.length, settings: Object.keys(data.settings).length };
}
export function checksum(data: ArchiveData): string { return createHash('sha256').update(JSON.stringify(data)).digest('hex'); }

export function validateArchiveData(input: unknown): ArchiveData {
  const data = archiveDataSchema.parse(input);
  const ids = <T extends { id: string }>(rows: T[]) => {
    const set = new Set(rows.map((row) => row.id));
    if (set.size !== rows.length) throw new Error('Duplicate archive ID');
    return set;
  };
  const providerIds = ids(data.providers);
  const chatIds = ids(data.chats);
  const messageIds = ids(data.messages);
  ids(data.attachments);
  for (const provider of data.providers) validateJson(provider);
  for (const chat of data.chats) {
    if (chat.providerId !== null && !providerIds.has(chat.providerId)) throw new Error('Invalid archive provider reference');
  }
  const positions = new Set<string>();
  for (const message of data.messages) {
    const key = JSON.stringify([message.chatId, message.position]);
    if (!chatIds.has(message.chatId) || positions.has(key)) throw new Error('Invalid archive message reference or position');
    positions.add(key);
  }
  const totals = new Map<string, { count: number; size: number }>();
  for (const file of data.attachments) {
    if (!messageIds.has(file.messageId) || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data) || file.data.length % 4 !== 0) throw new Error('Invalid archive attachment');
    const bytes = Buffer.from(file.data, 'base64');
    if (bytes.byteLength !== file.size || bytes.toString('base64') !== file.data) throw new Error('Invalid archive attachment size');
    const validated = validateAttachment({ name: file.name, type: file.mimeType, bytes, maxBytes: 10 * 1024 * 1024 });
    if (validated.name !== file.name || validated.type !== file.mimeType) throw new Error('Invalid archive attachment metadata');
    const total = totals.get(file.messageId) ?? { count: 0, size: 0 };
    total.count++; total.size += file.size;
    if (total.count > 10 || total.size > 20 * 1024 * 1024) throw new Error('Archive message attachments exceed limits');
    totals.set(file.messageId, total);
  }
  if (Object.keys(data.settings).length > 1000) throw new Error('Too many archive settings');
  for (const [key, value] of Object.entries(data.settings)) { settingKey(key); validateJson(value); }
  if (data.profile !== null) validateJson(data.profile, 16384);
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_ARCHIVE_BYTES - 4096) throw new Error('Archive size exceeded');
  return data;
}

export const manifestSchema = z.object({
  format: z.literal('onerouter'), version: z.literal(1), createdAt: timeSchema, checksum: z.string().regex(/^[a-f0-9]{64}$/),
  counts: z.object({ providers: timeSchema, chats: timeSchema, messages: timeSchema, attachments: timeSchema, settings: timeSchema }).strict(),
}).strict();
export type ArchiveManifest = z.infer<typeof manifestSchema>;
