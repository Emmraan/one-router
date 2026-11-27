import { describe, expect, it } from 'vitest';
import { parseMarkdown, rendererLimit } from './parse-markdown';

describe('parseMarkdown', () => {
  it.each([
    ['# Heading', [{ type: 'heading', level: 1, content: 'Heading' }]],
    ['###\tHeading', [{ type: 'heading', level: 3, content: 'Heading' }]],
    ['$$x^2$$', [{ type: 'math', content: 'x^2' }]],
    ['$$\nx^2\n$$', [{ type: 'math', content: 'x^2' }]],
    ['```ts\nconst x = 1;', [{ type: 'code', language: 'ts', content: 'const x = 1;' }]],
    ['| a |', [{ type: 'paragraph', content: '| a |' }]],
    ['####### plain', [{ type: 'paragraph', content: '####### plain' }]],
    ['- one\n- two', [{ type: 'list', ordered: false, items: ['one', 'two'] }]],
    ['1. one\n2. two', [{ type: 'list', ordered: true, items: ['one', 'two'] }]],
    ['> first\n> second', [{ type: 'quote', content: 'first\nsecond' }]],
  ])('parses %s without losing content or looping', (source, expected) => {
    expect(parseMarkdown(source)).toEqual(expected);
  });
  it('parses a table only when it has a separator row', () => {
    expect(parseMarkdown('| Name | Value |\n| --- | ---: |\n| one | 1 |')).toEqual([
      { type: 'table', headers: ['Name', 'Value'], rows: [['one', '1']] },
    ]);
  });
  it('bounds work for very large responses', () => {
    const parsed = parseMarkdown('a'.repeat(rendererLimit + 100));
    expect(parsed[0]).toEqual({ type: 'paragraph', content: 'a'.repeat(rendererLimit) });
    expect(parsed.at(-1)).toEqual({ type: 'notice', content: 'Preview limited to 100,000 characters. Copy or export for the full response.' });
    expect(parseMarkdown('# h\n\n'.repeat(10_000)).length).toBeLessThanOrEqual(1001);
  });
  it('bounds rendered list items across the entire response', () => {
    const parsed = parseMarkdown('- item\n'.repeat(10_000));
    const items = parsed.flatMap((block) => block.type === 'list' ? block.items : []);
    expect(items.length).toBeLessThanOrEqual(1000);
    expect(parsed.at(-1)?.type).toBe('notice');
  });
  it('bounds table cells even when a row contains thousands of columns', () => {
    const parsed = parseMarkdown(`|${' a |'.repeat(3000)}\n|${' --- |'.repeat(3000)}\n|${' b |'.repeat(3000)}`);
    const count = parsed.reduce((sum, block) => sum + (block.type === 'table' ? block.headers.length + block.rows.flat().length : 0), 0);
    expect(count).toBeLessThanOrEqual(1000);
    expect(parsed.at(-1)?.type).toBe('notice');
  });
  it('limits repeated expensive math and diagram blocks', () => {
    const parsed = parseMarkdown('$$x$$\n\n```mermaid\ngraph LR\nA-->B\n```\n'.repeat(100));
    expect(parsed.filter((block) => block.type === 'math' || block.type === 'code').length).toBeLessThanOrEqual(20);
    expect(parsed.at(-1)?.type).toBe('notice');
  });
});
