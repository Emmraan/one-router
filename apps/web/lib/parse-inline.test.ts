import { describe, expect, it } from 'vitest';
import { parseInline } from './parse-inline';

describe('parseInline', () => {
  it.each(['`unfinished', '*unfinished', '**unfinished', '_unfinished', 'plain * text'])('preserves incomplete markup: %s', (text) => {
    expect(parseInline(text)).toEqual([{ type: 'text', content: text }]);
  });
  it('keeps the existing code, bold, italic, link and math formats', () => {
    expect(parseInline('`code` **bold** *italic* _also italic_ [link](https://example.com) $x$').filter((part) => part.type !== 'text')).toEqual([
      { type: 'code', content: 'code' }, { type: 'strong', content: 'bold' }, { type: 'em', content: 'italic' },
      { type: 'em', content: 'also italic' }, { type: 'link', content: 'link', href: 'https://example.com' }, { type: 'math', content: 'x' },
    ]);
  });
  it('keeps disallowed links inert', () => {
    expect(parseInline('[link](javascript:alert)')).toEqual([{ type: 'link', content: 'link', href: '#' }]);
  });
  it('bounds formatting work without dropping the remaining text', () => {
    const text = '*a* '.repeat(3000);
    const parsed = parseInline(text);
    expect(parsed.length).toBeLessThanOrEqual(1001);
    expect(parsed.at(-1)?.content).toContain('*a*');
  });
  it.each(['['.repeat(100_000), '[x]('.repeat(25_000)])('bounds malformed link parsing, case %#', (text) => {
    const started = performance.now();
    expect(parseInline(text)).toEqual([{ type: 'text', content: text }]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
