import { describe, expect, it } from 'vitest';
import { evaluateRuntimeBudget, parseRss, percentile } from './runtime-budget.mjs';

describe('runtime budget measurements', () => {
  it('uses the nearest rank without mutating the samples', () => {
    const samples = [100, 1, 2, 3, 4];
    expect(percentile(samples, 0.95)).toBe(100);
    expect(percentile(samples, 0.5)).toBe(3);
    expect(samples).toEqual([100, 1, 2, 3, 4]);
    expect(percentile(Array.from({ length: 100 }, (_, i) => i + 1), 0.95)).toBe(95);
  });

  it.each([[], [NaN], [Infinity], [-1]].map((samples) => ({ samples })))('rejects invalid samples $samples', ({ samples }) => {
    expect(() => percentile(samples, 0.95)).toThrow();
  });

  it('parses ps KiB and Windows tasklist CSV without accepting missing processes', () => {
    expect(parseRss('  102400\n', 'linux')).toBe(100 * 1024 * 1024);
    expect(parseRss('"node.exe","1234","Console","1","102,400 K"\r\n', 'win32')).toBe(100 * 1024 * 1024);
    expect(() => parseRss('INFO: No tasks are running', 'win32')).toThrow();
    expect(() => parseRss('', 'linux')).toThrow();
    expect(() => parseRss('0', 'linux')).toThrow();
  });

  it('fails closed for missing measurements and enforces absolute limits', () => {
    expect(evaluateRuntimeBudget({ rssBytes: 149 * 1024 * 1024, p95Ms: 200 }).ok).toBe(true);
    expect(evaluateRuntimeBudget({ rssBytes: 150 * 1024 * 1024, p95Ms: 200 }).ok).toBe(false);
    expect(evaluateRuntimeBudget({ rssBytes: 1, p95Ms: 201 }).ok).toBe(false);
    expect(evaluateRuntimeBudget({ rssBytes: NaN, p95Ms: 1 }).ok).toBe(false);
  });
});
