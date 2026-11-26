import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor';
import { CoreError } from './errors';

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('cursor', () => {
  it('round-trips a cursor', () => {
    const cursor = { createdAt: 1_700_000_000_000, id: 'chat_1' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('produces a URL-safe opaque value', () => {
    const encoded = encodeCursor({ createdAt: 1, id: 'a/b+c=' });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('round-trips a unicode id', () => {
    const cursor = { createdAt: 42, id: 'chat-\u00e9\u4e16' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each([
    ['', 'empty'],
    ['!!!', 'invalid base64'],
    [base64Url('not json'), 'invalid json'],
    [base64Url('{"createdAt":-1,"id":"x"}'), 'negative time'],
    [base64Url('{"createdAt":1}'), 'missing id'],
    [base64Url('{"createdAt":1,"id":""}'), 'empty id'],
    [base64Url('{"createdAt":1,"id":2}'), 'non-string id'],
  ])('rejects %s (%s)', (value) => {
    expect(decodeCursor(value)).toBeNull();
  });

  it('refuses to encode an invalid cursor', () => {
    expect(() => encodeCursor({ createdAt: -1, id: 'x' })).toThrow(CoreError);
    expect(() => encodeCursor({ createdAt: 1, id: '' })).toThrow(CoreError);
  });
});
