import type { MiddlewareHandler } from 'hono';
import { errorCode, mapError } from '../errors';
import type { AppEnv, Logger } from '../types';

export const consoleLogger: Logger = (entry) => {
  const line = JSON.stringify(entry);
  if (entry.level === 'error') console.error(line);
  else console.log(line);
};

export function requestLogger(logger: Logger): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const started = performance.now();
    let status = 500;
    let code: string | undefined;
    try {
      await next();
      status = c.res.status;
    } catch (error) {
      status = mapError(error).status;
      code = errorCode(error);
      throw error;
    } finally {
      logger({
        level: status >= 500 ? 'error' : 'info',
        message: 'request',
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status,
        durationMs: Math.round(performance.now() - started),
        code,
      });
    }
  };
}
