import type { Context } from 'hono';

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
  return {
    check(key) {
      const now = options.now();
      if (entries.size > 10_000) {
        for (const [name, entry] of entries) if (entry.resetAt <= now) entries.delete(name);
      }
      const current = entries.get(key);
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

export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim();
    if (last) return last.slice(0, 100);
  }
  return (c.req.header('x-real-ip') ?? 'local').slice(0, 100);
}
