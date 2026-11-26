import { createHash } from 'node:crypto';
import { and, desc, eq, gt, isNotNull, isNull, or } from 'drizzle-orm';
import type { Store } from './client';
import { chats, messages } from './schema/tables';
import { chatAfter, chatCursor, decodeChat, type Chat, type ChatPageOptions } from './repositories/chats';
import { decodePage, encodePage, pageLimit } from './pagination';
import { unseal } from './repositories/codec';

export async function searchChats(store: Store, owner: string, query: string, options: ChatPageOptions & { signal?: AbortSignal } = {}) {
  if (typeof query !== 'string' || query.length > 200 || !query.trim()) throw new Error('Invalid search query (1 to 200 characters)');
  const needle = query.normalize('NFC').toLowerCase();
  const scope = JSON.stringify(['search', owner, !!options.trash, createHash('sha256').update(needle).digest('hex')]);
  const limit = pageLimit(options.limit);
  let cursor = decodePage(options.cursor, scope);
  const items: Chat[] = [];
  let scannedChats = 0;
  let scannedMessages = 0;
  const contains = (value: string) => value.normalize('NFC').toLowerCase().includes(needle);
  while (true) {
    options.signal?.throwIfAborted();
    const rows = await store.orm.select().from(chats).where(and(eq(chats.userId, owner),
      options.trash ? isNotNull(chats.deletedAt) : isNull(chats.deletedAt),
      cursor?.position ? or(chatAfter(cursor), eq(chats.id, cursor.id)) : chatAfter(cursor)))
      .orderBy(desc(chats.isPinned), desc(chats.updatedAt), desc(chats.id)).limit(50);
    if (!rows.length) return { items, nextCursor: null };
    for (const row of rows) {
      options.signal?.throwIfAborted();
      const chat = decodeChat(store, row);
      const resuming = cursor?.id === row.id && cursor.position > 0;
      let position = resuming ? cursor!.position - 1 : -1;
      let matched = !resuming && contains(chat.title);
      while (!matched) {
        options.signal?.throwIfAborted();
        const batch = await store.orm.select({ id: messages.id, content: messages.content, position: messages.position }).from(messages)
          .where(and(eq(messages.userId, owner), eq(messages.chatId, row.id), gt(messages.position, position))).orderBy(messages.position).limit(50);
        for (const message of batch) {
          position = message.position;
          scannedMessages++;
          matched = contains(unseal(store, owner, 'messages', message.id, 'content', message.content));
          if (matched) break;
        }
        if (matched || batch.length < 50) break;
        // Continue inside this chat on the next request instead of skipping unseen messages.
        if (scannedMessages >= 10000) return { items, nextCursor: encodePage({ scope, id: row.id, time: row.updatedAt, pinned: row.isPinned, position: position + 1 }) };
      }
      if (matched) items.push(chat);
      cursor = decodePage(chatCursor(scope, chat), scope);
      scannedChats++;
      if (items.length === limit || scannedChats >= 1000 || scannedMessages >= 10000) return { items, nextCursor: chatCursor(scope, chat) };
    }
    if (rows.length < 50) return { items, nextCursor: null };
  }
}
