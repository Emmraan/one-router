import { describe, expect, it } from 'vitest';
import { SseDecoder, parseSseLine } from './sse';

describe('parseSseLine', () => {
  const cases: Array<{ name: string; line: string; expected: ReturnType<typeof parseSseLine> }> = [
    { name: 'text frame', line: 'data: {"text":"hello"}', expected: { text: 'hello' } },
    { name: 'frame without a space', line: 'data:{"text":"a"}', expected: { text: 'a' } },
    { name: 'error frame', line: 'data: {"error":"upstream failed"}', expected: { error: 'upstream failed' } },
    { name: 'text and error together', line: 'data: {"text":"a","error":"b"}', expected: { text: 'a', error: 'b' } },
    { name: 'carriage return suffix', line: 'data: {"text":"a"}\r', expected: { text: 'a' } },
    { name: 'empty payload', line: 'data:', expected: null },
    { name: 'whitespace payload', line: 'data:   ', expected: null },
    { name: 'done sentinel', line: 'data: [DONE]', expected: null },
    { name: 'malformed json', line: 'data: {oops', expected: null },
    { name: 'json array', line: 'data: [1,2]', expected: null },
    { name: 'json string', line: 'data: "text"', expected: null },
    { name: 'json null', line: 'data: null', expected: null },
    { name: 'unknown fields only', line: 'data: {"other":1}', expected: {} },
    { name: 'non-string text ignored', line: 'data: {"text":42}', expected: {} },
    { name: 'non-string error ignored', line: 'data: {"error":null}', expected: {} },
    { name: 'comment line', line: ': keep-alive', expected: null },
    { name: 'event line', line: 'event: message', expected: null },
    { name: 'blank line', line: '', expected: null },
    { name: 'plain text line', line: 'hello', expected: null },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(parseSseLine(testCase.line)).toEqual(testCase.expected);
    });
  }
});

describe('SseDecoder', () => {
  it('decodes several frames from one chunk', () => {
    const decoder = new SseDecoder();
    const events = decoder.push('data: {"text":"a"}\n\ndata: {"text":"b"}\n\n');
    expect(events).toEqual([{ text: 'a' }, { text: 'b' }]);
  });

  it('buffers a frame split across chunks', () => {
    const decoder = new SseDecoder();
    expect(decoder.push('data: {"te')).toEqual([]);
    expect(decoder.push('xt":"split"}\n')).toEqual([{ text: 'split' }]);
  });

  it('buffers across three chunks', () => {
    const decoder = new SseDecoder();
    expect(decoder.push('da')).toEqual([]);
    expect(decoder.push('ta: {"text":')).toEqual([]);
    expect(decoder.push('"third"}\n\n')).toEqual([{ text: 'third' }]);
  });

  it('keeps the last partial line for the next push', () => {
    const decoder = new SseDecoder();
    expect(decoder.push('data: {"text":"a"}\ndata: {"text":')).toEqual([{ text: 'a' }]);
    expect(decoder.push('"b"}\n')).toEqual([{ text: 'b' }]);
  });

  it('flushes a trailing frame without a newline', () => {
    const decoder = new SseDecoder();
    expect(decoder.push('data: {"text":"tail"}')).toEqual([]);
    expect(decoder.flush()).toEqual([{ text: 'tail' }]);
    expect(decoder.flush()).toEqual([]);
  });

  it('drops a malformed trailing frame on flush', () => {
    const decoder = new SseDecoder();
    expect(decoder.push('data: {oops')).toEqual([]);
    expect(decoder.flush()).toEqual([]);
  });

  it('ignores comments, sentinels, and blank lines', () => {
    const decoder = new SseDecoder();
    const events = decoder.push(': ping\ndata: [DONE]\n\ndata: {"text":"kept"}\n\n');
    expect(events).toEqual([{ text: 'kept' }]);
  });

  it('decodes error frames', () => {
    const decoder = new SseDecoder();
    expect(decoder.push('data: {"error":"Provider failed"}\n\n')).toEqual([{ error: 'Provider failed' }]);
  });

  it('handles CRLF frames', () => {
    const decoder = new SseDecoder();
    expect(decoder.push('data: {"text":"crlf"}\r\n\r\n')).toEqual([{ text: 'crlf' }]);
  });
});
