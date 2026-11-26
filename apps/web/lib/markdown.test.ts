import { describe, expect, it } from 'vitest';
import { safeLinkHref } from './markdown';

describe('safeLinkHref', () => {
  const cases: Array<{ name: string; input: string; expected: string }> = [
    { name: 'https', input: 'https://example.com/a?b=1', expected: 'https://example.com/a?b=1' },
    { name: 'http', input: 'http://example.com', expected: 'http://example.com' },
    { name: 'mailto', input: 'mailto:owner@example.com', expected: 'mailto:owner@example.com' },
    { name: 'uppercase scheme', input: 'HTTPS://example.com', expected: 'HTTPS://example.com' },
    { name: 'surrounding space', input: '  https://example.com  ', expected: 'https://example.com' },
    { name: 'javascript scheme', input: 'javascript:alert(1)', expected: '#' },
    { name: 'mixed case javascript', input: 'JaVaScRiPt:alert(1)', expected: '#' },
    { name: 'data url', input: 'data:text/html,<script>alert(1)</script>', expected: '#' },
    { name: 'vbscript', input: 'vbscript:msgbox(1)', expected: '#' },
    { name: 'file scheme', input: 'file:///etc/passwd', expected: '#' },
    { name: 'protocol relative', input: '//evil.example', expected: '#' },
    { name: 'relative path', input: '/docs', expected: '#' },
    { name: 'empty', input: '', expected: '#' },
    { name: 'whitespace only', input: '   ', expected: '#' },
    {
      name: 'attribute breakout',
      input: 'https://example.com" onmouseover="alert(1)',
      expected: 'https://example.com&quot; onmouseover=&quot;alert(1)',
    },
    {
      name: 'single quote breakout',
      input: "https://example.com' onmouseover='alert(1)",
      expected: 'https://example.com&#39; onmouseover=&#39;alert(1)',
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(safeLinkHref(testCase.input)).toBe(testCase.expected);
    });
  }
});
