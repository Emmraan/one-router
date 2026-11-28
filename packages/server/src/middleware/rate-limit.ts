import type { Context } from 'hono';
import { isIP } from 'node:net';

interface Entry {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string): { allowed: boolean; retryAfterSec: number };
  reset(key: string): void;
}

export function createRateLimiter(options: { windowMs: number; max: number; now: () => number }): RateLimiter {
  const entries = new Map<string, Entry>();
  let nextCleanupAt = 0;
  return {
    check(key) {
      const now = options.now();
      if (!entries.has(key) && entries.size >= 1000 && now >= nextCleanupAt) {
        for (const [name, entry] of entries) if (entry.resetAt <= now) entries.delete(name);
        nextCleanupAt = now + 1000;
      }
      const current = entries.get(key);
      // Do not evict a live counter: rotating addresses must not reset another limit.
      if (!current && entries.size >= 1000) return { allowed: false, retryAfterSec: 1 };
      const entry = !current || current.resetAt <= now
        ? { count: 0, resetAt: now + options.windowMs }
        : current;
      entry.count += 1;
      entries.set(key, entry);
      return {
        allowed: entry.count <= options.max,
        retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      };
    },
    reset(key) {
      entries.delete(key);
    },
  };
}

export function clientIp(c: Context, trustProxy = false): string {
  // Fetch handlers lack an authenticated peer address; use one bucket unless explicitly behind a trusted proxy.
  if (!trustProxy) return 'local';
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim();
    if (last && isIP(last)) return last;
  }
  const real = c.req.header('x-real-ip')?.trim();
  return real && isIP(real) ? real : 'local';
}
