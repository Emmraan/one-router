import { CoreError } from '../errors';

const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const FORBIDDEN_HEADERS = new Set([
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
]);

function sanitizeHeaders(input: Record<string, unknown>): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (typeof rawValue !== 'string') continue;

    const key = rawKey.trim();
    if (!key) continue;
    if (!HEADER_NAME.test(key) || /[\r\n\0]/.test(rawValue)) {
      throw new CoreError('INVALID_REQUEST', `Invalid custom header: ${key}`);
    }
    if (FORBIDDEN_HEADERS.has(key.toLowerCase())) {
      throw new CoreError('INVALID_REQUEST', `Header not allowed: ${key}`);
    }

    headers[key] = rawValue;
  }

  return headers;
}

export function parseCustomHeaders(input: unknown): Record<string, string> {
  if (input === undefined || input === null || input === '') return {};

  if (typeof input === 'object' && !Array.isArray(input)) {
    return sanitizeHeaders(input as Record<string, unknown>);
  }

  if (typeof input !== 'string') return {};

  const trimmed = input.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return sanitizeHeaders(parsed as Record<string, unknown>);
      }
    } catch {
      // Fall through to the newline format.
    }
  }

  const parsed: Record<string, string> = {};
  for (const line of trimmed.replace(/\r\n?/g, '\n').split('\n')) {
    const index = line.indexOf(':');
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!key || !value) continue;
    if (!HEADER_NAME.test(key) || /[\r\n\0]/.test(value)) {
      throw new CoreError('INVALID_REQUEST', `Invalid custom header: ${key}`);
    }
    if (FORBIDDEN_HEADERS.has(key.toLowerCase())) {
      throw new CoreError('INVALID_REQUEST', `Header not allowed: ${key}`);
    }

    parsed[key] = value;
  }

  return parsed;
}

export function mergeHeaders(
  required: Record<string, string>,
  customHeaders: unknown,
): Record<string, string> {
  return { ...required, ...parseCustomHeaders(customHeaders) };
}

export function dataPayload(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  return payload || null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
