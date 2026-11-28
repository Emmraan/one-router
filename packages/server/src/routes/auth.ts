import { randomBytes } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { hashPassword, verifyPassword } from '@one-router/db';
import { z } from 'zod';
import { clearSessionCookie, setSessionCookie } from '../auth/cookies';
import { validateNewPassword } from '../auth/password';
import type { ServerEnv } from '../env';
import { HttpError } from '../errors';
import { readJson } from '../middleware/body';
import type { createAuth } from '../middleware/auth';
import { clientIp, type RateLimiter } from '../middleware/rate-limit';
import type { AppEnv } from '../types';

const loginSchema = z.object({ password: z.string().min(1).max(1024) }).strict();
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(1).max(1024),
  confirmation: z.string().min(1).max(1024),
}).strict();

let dummyHash: Promise<string> | undefined;
function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
  return dummyHash;
}

function rateLimited(c: { header: (name: string, value: string) => void }, retryAfterSec: number): never {
  c.header('Retry-After', String(retryAfterSec));
  throw new HttpError(429, 'Too many attempts. Try again later.', 'RATE_LIMITED');
}

export interface AuthRouteDeps {
  env: ServerEnv;
  now: () => number;
  auth: ReturnType<typeof createAuth>;
  loginLimiter: RateLimiter;
  passwordLimiter: RateLimiter;
}

export function authRoutes(deps: AuthRouteDeps) {
  const app = new Hono<AppEnv>();
  const repos = deps.auth.repos;
  let passwordWorkActive = false;
  const runPasswordWork = async <T>(c: Context<AppEnv>, work: () => Promise<T>): Promise<T> => {
    // Scrypt needs 128 MiB per operation; an IP header must not multiply that cost.
    if (passwordWorkActive) rateLimited(c, 1);
    passwordWorkActive = true;
    try {
      return await work();
    } finally {
      passwordWorkActive = false;
    }
  };

  app.get('/status', async (c) => {
    const auth = await deps.auth.resolve(c);
    if (!auth) return c.json({ authenticated: false, mustChangePassword: false });
    const user = await repos.users.get(auth.userId);
    return c.json({ authenticated: true, mustChangePassword: auth.mustChangePassword, user });
  });

  app.get('/me', deps.auth.requireAuth(), async (c) => {
    const user = await repos.users.get(c.get('ownerId'));
    return c.json({ user, mustChangePassword: c.get('auth')!.mustChangePassword });
  });

  app.post('/login', async (c) => {
    const limit = deps.loginLimiter.check(clientIp(c, deps.env.trustProxy));
    if (!limit.allowed) rateLimited(c, limit.retryAfterSec);
    const { password } = await readJson(c, loginSchema, 8 * 1024);
    // A slow request body must not reserve the password-work slot.
    return runPasswordWork(c, async () => {
      const owner = await repos.users.owner();

      if (!owner) {
        // Equalize the missing-owner path with a real scrypt verification.
        await verifyPassword(password, await dummyPasswordHash());
        throw new HttpError(401, 'Invalid password', 'INVALID_CREDENTIALS');
      }
      if (!(await repos.users.verifyPassword(owner.id, password, { now: deps.now() }))) {
        await repos.users.recordFailedLogin(owner.id, { now: deps.now() });
        throw new HttpError(401, 'Invalid password', 'INVALID_CREDENTIALS');
      }

      await repos.users.clearFailedLogins(owner.id);
      deps.loginLimiter.reset(clientIp(c, deps.env.trustProxy));
      const ttlMs = deps.env.sessionDays * 86400000;
      const session = await repos.sessions.create(owner.id, { now: deps.now(), ttlMs });
      setSessionCookie(c, session.token, deps.env, ttlMs);
      return c.json({ authenticated: true, mustChangePassword: owner.mustChangePassword, user: owner });
    });
  });

  app.post('/logout', async (c) => {
    const auth = await deps.auth.resolve(c);
    if (auth?.sessionToken) await repos.sessions.revoke(auth.sessionToken);
    clearSessionCookie(c, deps.env);
    return c.json({ ok: true });
  });

  app.post('/password', deps.auth.requireAuth(), async (c) => {
    const limit = deps.passwordLimiter.check(clientIp(c, deps.env.trustProxy));
    if (!limit.allowed) rateLimited(c, limit.retryAfterSec);
    const body = await readJson(c, passwordSchema, 8 * 1024);
    return runPasswordWork(c, async () => {
      const auth = c.get('auth');
      if (!auth) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
      const owner = await repos.users.get(auth.userId);
      if (!owner) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
      if (!(await repos.users.verifyPassword(auth.userId, body.currentPassword, { now: deps.now() }))) {
        throw new HttpError(400, 'Current password is incorrect', 'INVALID_CREDENTIALS');
      }
      const issues = validateNewPassword(body.newPassword, body.currentPassword, body.confirmation);
      if (issues.length > 0) throw new HttpError(400, 'Password does not meet the policy', 'WEAK_PASSWORD', issues);

      await repos.users.setPassword(auth.userId, body.newPassword);
      deps.passwordLimiter.reset(clientIp(c, deps.env.trustProxy));
      const ttlMs = deps.env.sessionDays * 86400000;
      const session = await repos.sessions.create(auth.userId, { now: deps.now(), ttlMs });
      setSessionCookie(c, session.token, deps.env, ttlMs);
      return c.json({ ok: true, mustChangePassword: false });
    });
  });

  return app;
}
