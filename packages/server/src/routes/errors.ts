import { ZodError } from 'zod';
import { HttpError } from '../errors';

export function repositoryFailure(error: unknown): never {
  if (error instanceof ZodError) throw error;
  const message = error instanceof Error ? error.message : '';
  if (/not found/i.test(message)) throw new HttpError(404, 'Not found', 'NOT_FOUND');
  if (/invalid|exceed|unavailable|duplicate|limit|attachment|temporary|migration/i.test(message)) {
    throw new HttpError(400, message, 'INVALID_REQUEST');
  }
  throw error;
}
