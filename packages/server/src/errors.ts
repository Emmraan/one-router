import { isCoreError } from '@one-router/core';
import { ZodError } from 'zod';

export const PROVIDER_ERROR_MESSAGE = 'Provider request failed. Check the provider configuration and try again.';

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: string[];

  constructor(status: number, message: string, code = statusCode(status), details?: string[]) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function statusCode(status: number): string {
  if (status === 400) return 'INVALID_REQUEST';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'UNAVAILABLE';
  return 'REQUEST_FAILED';
}

const secretPatterns: Array<[RegExp, string]> = [
  [/sk-[A-Za-z0-9_-]{8,}/g, 'sk-[redacted]'],
  [/(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]'],
  [/((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|passphrase|authorization)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, '$1[redacted]'],
  [/([?&]key=)[^&\s]+/gi, '$1[redacted]'],
];

export function redactSecrets(value: string): string {
  return secretPatterns.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function publicMessage(value: string): string {
  return redactSecrets(value).slice(0, 500);
}

export interface MappedError {
  status: number;
  code: string;
  message: string;
  details?: string[];
}

export function mapError(error: unknown): MappedError {
  if (error instanceof HttpError) {
    return { status: error.status, code: error.code,
      message: error.code.startsWith('UPSTREAM_') ? PROVIDER_ERROR_MESSAGE : publicMessage(error.message), details: error.details };
  }
  if (isCoreError(error)) {
    const status = error.status >= 400 && error.status <= 599 ? error.status : 500;
    // Provider-controlled text can contain credentials of any format, not just known key prefixes.
    return { status, code: error.code,
      message: error.code.startsWith('UPSTREAM_') ? PROVIDER_ERROR_MESSAGE : publicMessage(error.message) };
  }
  if (error instanceof ZodError) {
    const details = error.issues.slice(0, 20).map((issue) => {
      const path = issue.path.map(String).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Invalid request', details };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Server error' };
}

export function errorCode(error: unknown): string {
  if (error instanceof HttpError) return error.code;
  if (isCoreError(error)) return error.code;
  if (error instanceof ZodError) return 'VALIDATION_ERROR';
  return 'INTERNAL_ERROR';
}
