import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { atomic, type Store } from '../client';
import { hashPassword, verifyPassword } from '../crypto/password';
import { sessions, users } from '../schema/tables';
import { seal, unseal } from './codec';
import { timeSchema, validateJson } from './validation';

const sessionTtl = 30 * 24 * 60 * 60 * 1000;
function tokenHash(token: string): string | null {
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? createHash('sha256').update(token).digest('hex') : null;
}

export function identityRepositories(store: Store) {
  const getUser = async (id: string) => {
    const [row] = await store.orm.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) return null;
    const { passwordHash: _passwordHash, profile, ...publicUser } = row;
    return { ...publicUser, profile: profile ? JSON.parse(unseal(store, id, 'users', id, 'profile', profile)) as Record<string, unknown> : null };
  };
  const setPassword = async (id: string, password: string, options: { forceChange?: boolean } = {}) => {
    const passwordHash = await hashPassword(password);
    return atomic(store, async (tx) => {
      const changed = await tx.orm.update(users).set({ passwordHash, mustChangePassword: options.forceChange ?? false,
        failedLoginAttempts: 0, lockedUntil: null, updatedAt: Date.now() }).where(eq(users.id, id)).returning({ id: users.id });
      if (!changed.length) throw new Error('User not found');
      await tx.orm.delete(sessions).where(eq(sessions.userId, id));
    });
  };
  return {
    users: {
      get: getUser,
      async updateProfile(id: string, profile: Record<string, unknown>) {
        const text = validateJson(profile, 16384);
        await store.orm.update(users).set({ profile: seal(store, id, 'users', id, 'profile', text), updatedAt: Date.now() }).where(eq(users.id, id));
        return getUser(id);
      },
      setPassword,
      async verifyPassword(id: string, password: string, options: { now?: number } = {}) {
        const [user] = await store.orm.select().from(users).where(eq(users.id, id)).limit(1);
        if (!user || (user.lockedUntil !== null && user.lockedUntil > (options.now ?? Date.now()))) return false;
        return verifyPassword(password, user.passwordHash);
      },
      async recordFailedLogin(id: string, options: { now?: number } = {}) {
        const now = timeSchema.parse(options.now ?? Date.now());
        await store.orm.update(users).set({
          failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`,
          lockedUntil: sql`CASE WHEN ${users.failedLoginAttempts} + 1 >= 5 THEN ${now + 15 * 60000} ELSE ${users.lockedUntil} END`,
        }).where(eq(users.id, id));
      },
      async clearFailedLogins(id: string) {
        await store.orm.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, id));
      },
    },
    sessions: {
      async create(userId: string, options: { now?: number; ttlMs?: number } = {}) {
        const now = timeSchema.parse(options.now ?? Date.now());
        const ttl = options.ttlMs ?? sessionTtl;
        if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 365 * 86400000) throw new Error('Invalid session lifetime');
        const token = randomBytes(32).toString('base64url');
        await store.orm.insert(sessions).values({ tokenHash: tokenHash(token)!, userId, createdAt: now, lastSeenAt: now, expiresAt: now + ttl });
        return { token, userId, expiresAt: now + ttl };
      },
      async find(token: string, options: { now?: number } = {}) {
        const hash = tokenHash(token);
        if (!hash) return null;
        const now = timeSchema.parse(options.now ?? Date.now());
        const [row] = await store.orm.select({ userId: sessions.userId, createdAt: sessions.createdAt,
          lastSeenAt: sessions.lastSeenAt, expiresAt: sessions.expiresAt, mustChangePassword: users.mustChangePassword })
          .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
          .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, now))).limit(1);
        return row ?? null;
      },
      async touch(token: string, options: { now?: number } = {}) {
        const hash = tokenHash(token);
        if (!hash) return;
        const now = timeSchema.parse(options.now ?? Date.now());
        await store.orm.update(sessions).set({ lastSeenAt: now, expiresAt: now + sessionTtl })
          .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, now)));
      },
      async revoke(token: string) {
        const hash = tokenHash(token);
        if (hash) await store.orm.delete(sessions).where(eq(sessions.tokenHash, hash));
      },
      async revokeAll(userId: string) { await store.orm.delete(sessions).where(eq(sessions.userId, userId)); },
      async cleanup(now = Date.now()) { await store.orm.delete(sessions).where(lte(sessions.expiresAt, timeSchema.parse(now))); },
    },
  };
}
