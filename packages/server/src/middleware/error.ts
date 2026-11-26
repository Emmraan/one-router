import type { ErrorHandler, NotFoundHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { mapError } from '../errors';
import type { AppEnv } from '../types';

export const handleError: ErrorHandler<AppEnv> = (error, c) => {
  const mapped = mapError(error);
  c.header('Cache-Control', 'no-store');
  return c.json({
    error: mapped.message,
    code: mapped.code,
    requestId: c.get('requestId') ?? '',
    ...(mapped.details ? { details: mapped.details } : {}),
  }, mapped.status as ContentfulStatusCode);
};

export const notFound: NotFoundHandler<AppEnv> = (c) => c.json({
  error: 'Not found',
  code: 'NOT_FOUND',
  requestId: c.get('requestId') ?? '',
}, 404);
