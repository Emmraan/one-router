import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, isNull, max } from 'drizzle-orm';
import { z } from 'zod';
import { atomic, type Store } from '../client';
import { attachments, chats, messages } from '../schema/tables';
import { decodePage, encodePage, pageLimit } from '../pagination';
import { seal, unseal } from './codec';
import { messageInputSchema } from './validation';

export function decodeMessage(store: Store, row: typeof messages.$inferSelect) {
  const { userId, ...value } = row;
  return { ...value, content: unseal(store, userId, 'messages', row.id, 'content', row.content) };
}
export function messageRepository(store: Store) {
  const get = async (owner: string, id: string) => {
    const [row] = await store.orm.select().from(messages).where(and(eq(messages.userId, owner), eq(messages.id, id))).limit(1);
    return row ? decodeMessage(store, row) : null;
  };
  return {
    get,
    async append(owner: string, chatId: string, input: z.input<typeof messageInputSchema>) {
      const value = messageInputSchema.parse(input);
      const id = value.id ?? randomUUID();
      const fileIds = value.attachmentIds ?? [];
      if (new Set(fileIds).size !== fileIds.length) throw new Error('Duplicate attachment');
      return atomic(store, async (tx) => {
        const [chat] = await tx.orm.select({ id: chats.id }).from(chats)
          .where(and(eq(chats.userId, owner), eq(chats.id, chatId), isNull(chats.deletedAt))).limit(1);
        if (!chat) throw new Error('Chat not found');
        const [{ position }] = await tx.orm.select({ position: max(messages.position) }).from(messages)
          .where(and(eq(messages.userId, owner), eq(messages.chatId, chatId)));
        if (typeof position === 'number' && position >= 100000000) throw new Error('Message position limit exceeded');
        const now = value.createdAt ?? Date.now();
        await tx.orm.insert(messages).values({ id, userId: owner, chatId, role: value.role, model: value.model ?? null,
          content: seal(tx, owner, 'messages', id, 'content', value.content), position: (position ?? -1) + 1,
          isRegenerated: value.isRegenerated ?? false, createdAt: now, updatedAt: now });
        let total = 0;
        for (const fileId of fileIds) {
          const [file] = await tx.orm.select().from(attachments).where(and(eq(attachments.userId, owner), eq(attachments.id, fileId))).limit(1);
          if (!file || file.messageId !== null || (file.expiresAt !== null && file.expiresAt <= Date.now())) throw new Error('Attachment not available');
          total += file.size;
          if (total > 20 * 1024 * 1024) throw new Error('Attachment total size exceeded');
          await tx.orm.update(attachments).set({ messageId: id, expiresAt: null }).where(and(eq(attachments.userId, owner), eq(attachments.id, fileId)));
        }
        await tx.orm.update(chats).set({ updatedAt: Date.now() }).where(and(eq(chats.userId, owner), eq(chats.id, chatId)));
        return (await messageRepository(tx).get(owner, id))!;
      });
    },
    async list(owner: string, chatId: string, options: { limit?: number; cursor?: string } = {}) {
      const limit = pageLimit(options.limit);
      const scope = JSON.stringify(['messages', owner, chatId]);
      const cursor = decodePage(options.cursor, scope);
      const rows = await store.orm.select().from(messages).where(and(eq(messages.userId, owner), eq(messages.chatId, chatId),
        cursor ? gt(messages.position, cursor.position) : undefined)).orderBy(asc(messages.position)).limit(limit + 1);
      const items = rows.slice(0, limit).map((row) => decodeMessage(store, row));
      const last = items.at(-1);
      return { items, nextCursor: rows.length > limit && last ? encodePage({ scope, id: last.id, position: last.position, time: 0, pinned: false }) : null };
    },
    async update(owner: string, id: string, content: string) {
      z.string().max(100000).parse(content);
      await store.orm.update(messages).set({ content: seal(store, owner, 'messages', id, 'content', content), updatedAt: Date.now() })
        .where(and(eq(messages.userId, owner), eq(messages.id, id)));
      return get(owner, id);
    },
    async delete(owner: string, id: string) {
      await store.orm.delete(messages).where(and(eq(messages.userId, owner), eq(messages.id, id)));
    },
  };
}
