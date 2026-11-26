import { randomUUID } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { atomic, type Store } from '../client';
import { chats, providers, settings } from '../schema/tables';
import { seal, unseal } from './codec';
import { providerInputSchema, settingKey, validateJson } from './validation';

type ProviderInput = z.input<typeof providerInputSchema>;
export function configurationRepositories(store: Store) {
  const resolve = async (owner: string, id: string) => {
    const [row] = await store.orm.select().from(providers).where(and(eq(providers.userId, owner), eq(providers.id, id))).limit(1);
    if (!row) return null;
    const config = providerInputSchema.parse(JSON.parse(unseal(store, owner, 'providers', id, 'config', row.config)));
    return { ...config, id: row.id, isActive: row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt };
  };
  const mask = (value: NonNullable<Awaited<ReturnType<typeof resolve>>>) => {
    const { apiKey, customHeaders: _headers, ...publicProvider } = value;
    return { ...publicProvider, hasApiKey: !!apiKey, apiKey: undefined, customHeaders: undefined };
  };
  const get = async (owner: string, id: string) => { const value = await resolve(owner, id); return value ? mask(value) : null; };
  return {
    providers: {
      resolve, get,
      async list(owner: string) {
        const rows = await store.orm.select({ id: providers.id }).from(providers).where(eq(providers.userId, owner)).orderBy(asc(providers.createdAt), asc(providers.id)).limit(1000);
        return Promise.all(rows.map(async (row) => (await get(owner, row.id))!));
      },
      async create(owner: string, input: ProviderInput) {
        const config = providerInputSchema.parse(input);
        const id = config.id ?? randomUUID();
        const now = Date.now();
        await store.orm.insert(providers).values({ id, userId: owner, type: config.type, isActive: config.isActive,
          config: seal(store, owner, 'providers', id, 'config', validateJson(config)), createdAt: now, updatedAt: now });
        return (await get(owner, id))!;
      },
      async update(owner: string, id: string, patch: Partial<Omit<ProviderInput, 'id'>>) {
        return atomic(store, async (tx) => {
          const previous = await configurationRepositories(tx).providers.resolve(owner, id);
          if (!previous) return null;
          const { createdAt: _createdAt, updatedAt: _updatedAt, ...config } = previous;
          const value = providerInputSchema.parse({ ...config, ...patch, id });
          await tx.orm.update(providers).set({ config: seal(tx, owner, 'providers', id, 'config', validateJson(value)),
            type: value.type, isActive: value.isActive, updatedAt: Date.now() }).where(and(eq(providers.userId, owner), eq(providers.id, id)));
          return configurationRepositories(tx).providers.get(owner, id);
        });
      },
      async delete(owner: string, id: string) {
        await atomic(store, async (tx) => {
          await tx.orm.update(chats).set({ providerId: null }).where(and(eq(chats.userId, owner), eq(chats.providerId, id)));
          await tx.orm.delete(providers).where(and(eq(providers.userId, owner), eq(providers.id, id)));
        });
      },
    },
    settings: {
      async get(owner: string): Promise<Record<string, unknown>> {
        const rows = await store.orm.select().from(settings).where(eq(settings.userId, owner));
        return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(unseal(store, owner, 'settings', row.key, 'value', row.value))]));
      },
      async set(owner: string, key: string, value: unknown) {
        settingKey(key);
        const encrypted = seal(store, owner, 'settings', key, 'value', validateJson(value));
        await store.orm.insert(settings).values({ userId: owner, key, value: encrypted, updatedAt: Date.now() })
          .onConflictDoUpdate({ target: [settings.userId, settings.key], set: { value: encrypted, updatedAt: Date.now() } });
      },
      async delete(owner: string, key: string) {
        await store.orm.delete(settings).where(and(eq(settings.userId, owner), eq(settings.key, settingKey(key))));
      },
    },
  };
}
