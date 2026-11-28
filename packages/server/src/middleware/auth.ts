import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { createRepositories, type Database } from '@one-router/db';
import { readSessionCookie, setSessionCookie } from '../auth/cookies';
import type { ServerEnv } from '../env';
import { HttpError } from '../errors';
import type { AppEnv, AuthContext } from '../types';

const passwordChangePaths = new Set([
  '/api/auth/status', '/api/auth/me', '/api/auth/logout', '/api/auth/password',
]);
const touchIntervalMs = 60 * 60 * 1000;

export function safeTokenEqual(left: string, right: string): boolean {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}

export interface AuthDeps {
  db: Database;
  env: ServerEnv;
  now: () => number;
}

export function createAuth(deps: AuthDeps) {
  const repos = createRepositories(deps.db);
  let cachedOwner: string | null | undefined;

  const ownerId = async (): Promise<string | null> => {
    if (cachedOwner !== undefined) return cachedOwner;
    cachedOwner = (await repos.users.owner())?.id ?? null;
    return cachedOwner;
  };

  const resolve = async (c: Context<AppEnv>): Promise<AuthContext | null> => {
    const authorization = c.req.header('authorization');
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.slice(7).trim();
      const owner = await ownerId();
      if (!owner || !deps.env.authToken || !safeTokenEqual(token, deps.env.authToken)) return null;
      const user = await repos.users.get(owner);
      if (!user) return null;
      return { kind: 'bearer', userId: owner, mustChangePassword: user.mustChangePassword };
    }

    const token = readSessionCookie(c);
    if (!token) return null;
    const session = await repos.sessions.find(token, { now: deps.now() });
    if (!session) return null;
    if (deps.now() - session.lastSeenAt > touchIntervalMs) {
      await repos.sessions.touch(token, { now: deps.now(), ttlMs: deps.env.sessionDays * 86400000 });
      // The database expiry slides, so the browser cookie must slide with it.
      setSessionCookie(c, token, deps.env, deps.env.sessionDays * 86400000);
    }
    return {
      kind: 'session',
      userId: session.userId,
      mustChangePassword: session.mustChangePassword,
      sessionToken: token,
    };
  };

  const requireAuth = (): MiddlewareHandler<AppEnv> => async (c, next) => {
    const auth = await resolve(c);
    if (!auth) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    if (auth.mustChangePassword && !passwordChangePaths.has(c.req.path)) {
      throw new HttpError(403, 'Change the bootstrap password before using the API', 'PASSWORD_CHANGE_REQUIRED');
    }
    c.set('auth', auth);
    c.set('ownerId', auth.userId);
    await next();
  };

  const optionalAuth = (): MiddlewareHandler<AppEnv> => async (c, next) => {
    const auth = await resolve(c);
    if (auth) {
      c.set('auth', auth);
      c.set('ownerId', auth.userId);
    }
    await next();
  };

  return { resolve, requireAuth, optionalAuth, ownerId, repos };
}
