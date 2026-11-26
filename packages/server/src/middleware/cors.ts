import type { MiddlewareHandler } from 'hono';
import type { ServerEnv } from '../env';
import { HttpError } from '../errors';

export function cors(env: ServerEnv): MiddlewareHandler {
  return async (c, next) => {
    const origin = c.req.header('origin');
    const allowed = origin !== undefined && env.allowedOrigins.includes(origin);
    c.header('Vary', 'Origin');
    if (allowed) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Expose-Headers', 'X-Request-ID');
    }
    if (c.req.method === 'OPTIONS') {
      if (origin && !allowed) throw new HttpError(403, 'Origin not allowed', 'ORIGIN_NOT_ALLOWED');
      c.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
      c.header('Access-Control-Max-Age', '600');
      return c.body(null, 204);
    }
    await next();
  };
}
