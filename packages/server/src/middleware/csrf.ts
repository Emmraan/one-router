import type { MiddlewareHandler } from 'hono';
import type { ServerEnv } from '../env';
import { HttpError } from '../errors';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function sameHost(c: { req: { header: (name: string) => string | undefined } }, origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = c.req.header('host');
    return !!host && url.host === host && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

export function csrf(env: ServerEnv): MiddlewareHandler {
  return async (c, next) => {
    if (safeMethods.has(c.req.method) || c.req.header('authorization')?.startsWith('Bearer ')) {
      await next();
      return;
    }

    const origin = c.req.header('origin');
    if (origin !== undefined) {
      if (origin === 'null' || (!env.allowedOrigins.includes(origin) && !sameHost(c, origin))) {
        throw new HttpError(403, 'Cross-site request rejected', 'CSRF_REJECTED');
      }
      await next();
      return;
    }

    if (c.req.header('sec-fetch-site') === 'same-origin') {
      await next();
      return;
    }

    throw new HttpError(403, 'Missing request origin', 'CSRF_REJECTED');
  };
}
