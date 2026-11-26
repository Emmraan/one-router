import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

const requestIdPattern = /^[A-Za-z0-9._-]{1,100}$/;

export function requestId(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incoming = c.req.header('x-request-id');
    const id = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID();
    c.set('requestId', id);
    c.header('x-request-id', id);
    await next();
  };
}
