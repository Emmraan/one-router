import { describe, expect, it } from 'vitest';
import { SseParser, encodeSse } from './sse';

function collect(chunks: string[], options?: ConstructorParameters<typeof SseParser>[0]) {
  const parser = new SseParser(options);
  const events = chunks.flatMap((chunk) => parser.push(chunk));
  return [...events, ...parser.flush()];
}

describe('SseParser', () => {
  it('parses an event split across chunks', () => {
    expect(collect(['data: {"a"', ':1}\n\n'])).toEqual([{ data: '{"a":1}' }]);
  });

  it('joins multi-line data fields', () => {
    expect(collect(['data: first\ndata: second\n\n'])).toEqual([
      { data: 'first\nsecond' },
    ]);
  });

  it('handles CRLF, comments, and event names', () => {
    expect(collect(['event: ping\r\ndata: x\r\n\r\n: keepalive\n\n'])).toEqual([
      { event: 'ping', data: 'x' },
    ]);
  });

  it('parses id and retry fields', () => {
    expect(collect(['id: 7\nretry: 1000\ndata: x\n\n'])).toEqual([
      { id: '7', retry: 1000, data: 'x' },
    ]);
  });

  it('accepts data without a leading space', () => {
    expect(collect(['data:x\n\n'])).toEqual([{ data: 'x' }]);
  });

  it('flushes a trailing event with no blank line', () => {
    expect(collect(['data: tail'])).toEqual([{ data: 'tail' }]);
  });

  it('ignores blank lines with no fields', () => {
    expect(collect(['\n\n\n'])).toEqual([]);
  });

  it('drops events that only carry a comment', () => {
    expect(collect([': note\n\n'])).toEqual([]);
  });

  it('caps an oversized buffered line', () => {
    const parser = new SseParser({ maxBufferBytes: 8 });
    expect(() => parser.push('data: 123456789')).toThrow(/buffer/i);
  });

  it('caps data lines that never reach an event separator', () => {
    const parser = new SseParser({ maxBufferBytes: 16 });
    expect(() => parser.push('data: x\n'.repeat(100))).toThrow(/event/i);
  });
});

describe('encodeSse', () => {
  it('encodes a JSON payload as a data frame', () => {
    expect(encodeSse({ text: 'hi' })).toBe('data: {"text":"hi"}\n\n');
  });
});
