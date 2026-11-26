import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import type { Store } from '../client';
import { chats } from '../schema/tables';
import { decodePage, encodePage, pageLimit, type Cursor } from '../pagination';
import { seal, unseal } from './codec';
import { chatInputSchema, modelSchema, timeSchema, titleSchema } from './validation';

export type Chat = Omit<typeof chats.$inferSelect, 'userId'>;
export type ChatPageOptions = { limit?: number; cursor?: string; trash?: boolean };
export function chatScope(owner: string, trash = false): string { return JSON.stringify(['chats', owner, trash]); }
export function chatCursor(scope: string, row: Chat): string {
  return encodePage({ scope, id: row.id, time: row.updatedAt, pinned: row.isPinned, position: 0 });
}
export function chatAfter(cursor: Cursor | null) {
  if (!cursor) return undefined;
  const older = or(lt(chats.updatedAt, cursor.time), and(eq(chats.updatedAt, cursor.time), lt(chats.id, cursor.id)));
  return cursor.pinned ? or(eq(chats.isPinned, false), and(eq(chats.isPinned, true), older)) : and(eq(chats.isPinned, false), older);
}
export function decodeChat(store: Store, row: typeof chats.$inferSelect): Chat {
  const { userId, ...value } = row;
  return { ...value, title: unseal(store, userId, 'chats', row.id, 'title', row.title) };
}

export function chatRepository(store: Store) {
  const get = async (owner: string, id: string) => {
    const [row] = await store.orm.select().from(chats).where(and(eq(chats.userId, owner), eq(chats.id, id))).limit(1);
    return row ? decodeChat(store, row) : null;
  };
  return {
    get,
    async create(owner: string, input: z.input<typeof chatInputSchema>) {
      const value = chatInputSchema.parse(input);
      if (value.isTemporary) throw new Error('Temporary chats cannot be persisted');
      const id = value.id ?? randomUUID();
      const now = value.now ?? Date.now();
      await store.orm.insert(chats).values({ id, userId: owner, title: seal(store, owner, 'chats', id, 'title', value.title),
        model: value.model, providerId: value.providerId ?? null, isPinned: value.isPinned ?? false, createdAt: now, updatedAt: now });
      return (await get(owner, id))!;
    },
    async list(owner: string, options: ChatPageOptions = {}) {
      const limit = pageLimit(options.limit);
      const scope = chatScope(owner, options.trash);
      const cursor = decodePage(options.cursor, scope);
      const rows = await store.orm.select().from(chats).where(and(eq(chats.userId, owner),
        options.trash ? isNotNull(chats.deletedAt) : isNull(chats.deletedAt), chatAfter(cursor)))
        .orderBy(desc(chats.isPinned), desc(chats.updatedAt), desc(chats.id)).limit(limit + 1);
      const items = rows.slice(0, limit).map((row) => decodeChat(store, row));
      return { items, nextCursor: rows.length > limit ? chatCursor(scope, items.at(-1)!) : null };
    },
    async rename(owner: string, id: string, title: string, source: 'manual' | 'automatic' = 'manual') {
      titleSchema.parse(title);
      await store.orm.update(chats).set({ title: seal(store, owner, 'chats', id, 'title', title),
        manualTitle: source === 'manual', updatedAt: Date.now() })
        .where(and(eq(chats.userId, owner), eq(chats.id, id), source === 'automatic' ? eq(chats.manualTitle, false) : undefined));
      return get(owner, id);
    },
    async setPinned(owner: string, id: string, pinned: boolean) {
      z.boolean().parse(pinned);
      await store.orm.update(chats).set({ isPinned: pinned }).where(and(eq(chats.userId, owner), eq(chats.id, id)));
    },
    async setModel(owner: string, id: string, model: string, providerId: string | null) {
      modelSchema.parse(model);
      await store.orm.update(chats).set({ model, providerId, updatedAt: Date.now() }).where(and(eq(chats.userId, owner), eq(chats.id, id)));
    },
    async softDelete(owner: string, id: string, now = Date.now()) {
      await store.orm.update(chats).set({ deletedAt: timeSchema.parse(now) }).where(and(eq(chats.userId, owner), eq(chats.id, id)));
    },
    async restore(owner: string, id: string) {
      await store.orm.update(chats).set({ deletedAt: null }).where(and(eq(chats.userId, owner), eq(chats.id, id)));
    },
    async permanentlyDelete(owner: string, id: string) {
      await store.orm.delete(chats).where(and(eq(chats.userId, owner), eq(chats.id, id)));
    },
  };
}
