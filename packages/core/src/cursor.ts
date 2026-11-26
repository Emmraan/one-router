import { CoreError } from './errors';

export interface Cursor {
  createdAt: number;
  id: string;
}

const MAX_ID_LENGTH = 200;

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPadding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function isValidCursor(value: unknown): value is Cursor {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { createdAt?: unknown; id?: unknown };
  return (
    typeof candidate.createdAt === 'number' &&
    Number.isSafeInteger(candidate.createdAt) &&
    candidate.createdAt >= 0 &&
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    candidate.id.length <= MAX_ID_LENGTH
  );
}

export function encodeCursor(cursor: Cursor): string {
  if (!isValidCursor(cursor)) {
    throw new CoreError('INVALID_CURSOR', 'Invalid cursor');
  }
  return base64UrlEncode(JSON.stringify(cursor));
}

export function decodeCursor(value: string): Cursor | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const decoded = JSON.parse(base64UrlDecode(value)) as unknown;
    return isValidCursor(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
