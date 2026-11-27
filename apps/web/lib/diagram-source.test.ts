import { describe, expect, it } from 'vitest';
import { isSafeDiagramSource } from './diagram-source';

describe('isSafeDiagramSource', () => {
  it.each([
    'graph LR\n A[Prompt] --> B[Provider]',
    'sequenceDiagram\n Alice->>Bob: Hello',
    'pie title Routes\n "Local" : 3\n "Remote" : 1',
  ])('allows local diagrams: %s', (source) => expect(isSafeDiagramSource(source)).toBe(true));
  it.each([
    'a'.repeat(10_001),
    'graph LR\n' + ' A-->B;'.repeat(101),
    '%%{init: {"securityLevel":"loose"}}%%\ngraph LR\nA-->B',
    '---\nconfig:\n securityLevel: loose\n---\ngraph LR\nA-->B',
    'graph LR\nA-->B\nclick A "https://example.com"',
    'graph LR\nA@{ img: "relative.png" }',
    'graph LR\nA[<img src="//example.com/a">]',
    'graph LR\nA[https://example.com/a]',
    'graph LR\nA[DATA:image/svg+xml;base64,abc]',
    'graph LR\nstyle A fill:url(relative.svg)',
    'graph LR\nA-->B\nstyle A fill:\\75rl(\\68ttps\\3a\\2f\\2fexample.com)',
  ])('rejects unbounded, configurable or external content', (source) => expect(isSafeDiagramSource(source)).toBe(false));
});
