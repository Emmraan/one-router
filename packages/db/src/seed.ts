import { randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Store } from './client';
import { hashPassword } from './crypto/password';
import { identityRepositories } from './repositories/identity';
import { users } from './schema/tables';

export async function seedOwner(store: Store, options: { password?: string } = {}) {
  const find = async () => (await store.orm.select({ id: users.id }).from(users).where(eq(users.role, 'owner')).limit(1))[0];
  const existing = await find();
  if (existing) return { created: false, user: (await identityRepositories(store).users.get(existing.id))!, password: undefined };
  const password = options.password ?? randomBytes(24).toString('base64url');
  const now = Date.now();
  const id = randomUUID();
  const inserted = await store.orm.insert(users).values({ id, role: 'owner', passwordHash: await hashPassword(password),
    mustChangePassword: true, createdAt: now, updatedAt: now }).onConflictDoNothing().returning({ id: users.id });
  const owner = inserted[0] ?? await find();
  if (!owner) throw new Error('Owner bootstrap failed');
  return { created: inserted.length > 0, user: (await identityRepositories(store).users.get(owner.id))!, password: inserted.length ? password : undefined };
}
