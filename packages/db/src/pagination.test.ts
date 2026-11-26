import { expect, it } from 'vitest';
import { decodePage, encodePage, pageLimit } from './pagination';

const cursor = { scope: 'owner:chats:active', id: 'chat-a', time: 123, pinned: true, position: 0 };
it('round-trips a typed cursor and binds it to its owner and query', () => {
  expect(decodePage(encodePage(cursor), cursor.scope)).toEqual(cursor);
  expect(decodePage(undefined, cursor.scope)).toBeNull();
  expect(() => decodePage(encodePage(cursor), 'other-owner')).toThrow('cursor');
});
it.each(['', "'; SELECT * FROM users; --", '!', 'a'.repeat(2049), Buffer.from('{}').toString('base64url'),
  Buffer.from(JSON.stringify({ ...cursor, position: -1 })).toString('base64url'),
  Buffer.from(JSON.stringify({ ...cursor, extra: true })).toString('base64url'),
])('rejects malformed cursor %j', (value) => {
  expect(() => decodePage(value, cursor.scope)).toThrow('cursor');
});
it.each([0, -1, 101, 100000, 1.5, NaN, Infinity])('rejects invalid page limit %j', (value) => {
  expect(() => pageLimit(value)).toThrow('limit');
});
it.each([1, 50, 100])('accepts page limit %i', (value) => { expect(pageLimit(value)).toBe(value); });
