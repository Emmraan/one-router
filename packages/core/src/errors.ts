export type CoreErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_URL'
  | 'BLOCKED_URL'
  | 'UNSUPPORTED_PROVIDER'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_STATUS'
  | 'EMPTY_RESPONSE'
  | 'EMPTY_FILE'
  | 'FILE_TOO_LARGE'
  | 'TOTAL_TOO_LARGE'
  | 'TOO_MANY_FILES'
  | 'UNSUPPORTED_TYPE'
  | 'MIME_MISMATCH'
  | 'EXTENSION_MISMATCH'
  | 'INVALID_CURSOR'
  | 'ABORTED';

export class CoreError extends Error {
  constructor(
    public readonly code: CoreErrorCode,
    message: string,
    public readonly status = 400,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'CoreError';
  }
}

export function isCoreError(value: unknown): value is CoreError {
  return value instanceof CoreError;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}
