import { describe, expect, it } from 'vitest';
import { applyTheme, normalizeTheme, readThemeCookie, writeThemeCookie } from './theme';

describe('normalizeTheme', () => {
  const cases: Array<{ value: unknown; expected: 'light' | 'dark' }> = [
    { value: 'light', expected: 'light' },
    { value: 'dark', expected: 'dark' },
    { value: 'system', expected: 'dark' },
    { value: 'LIGHT', expected: 'dark' },
    { value: '', expected: 'dark' },
    { value: null, expected: 'dark' },
    { value: undefined, expected: 'dark' },
    { value: 0, expected: 'dark' },
  ];

  for (const testCase of cases) {
    it(`maps ${String(testCase.value)} to ${testCase.expected}`, () => {
      expect(normalizeTheme(testCase.value)).toBe(testCase.expected);
    });
  }
});

describe('readThemeCookie', () => {
  const cases: Array<{ name: string; cookie: string; expected: 'light' | 'dark' | null }> = [
    { name: 'only cookie', cookie: 'one_router_theme=light', expected: 'light' },
    { name: 'dark value', cookie: 'one_router_theme=dark', expected: 'dark' },
    { name: 'middle cookie', cookie: 'a=1; one_router_theme=dark; b=2', expected: 'dark' },
    { name: 'first of several', cookie: 'one_router_theme=light; a=1', expected: 'light' },
    { name: 'leading space', cookie: ' one_router_theme=light', expected: 'light' },
    { name: 'space after semicolon', cookie: 'a=1;   one_router_theme=light', expected: 'light' },
    { name: 'missing', cookie: 'a=1; b=2', expected: null },
    { name: 'empty', cookie: '', expected: null },
    { name: 'invalid value', cookie: 'one_router_theme=blue', expected: null },
    { name: 'suffix without boundary', cookie: 'one_router_theme=lightx', expected: null },
    { name: 'name suffix', cookie: 'xone_router_theme=light', expected: null },
    { name: 'prefix name', cookie: 'one_router_theme_extra=light', expected: null },
    { name: 'quoted value', cookie: 'one_router_theme="light"', expected: null },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(readThemeCookie(testCase.cookie)).toBe(testCase.expected);
    });
  }
});

describe('applyTheme', () => {
  function fakeRoot() {
    const calls: Array<[string, boolean]> = [];
    return {
      calls,
      classList: {
        toggle(token: string, force: boolean) {
          calls.push([token, force]);
        },
      },
    };
  }

  it('adds the dark class for dark', () => {
    const root = fakeRoot();
    applyTheme('dark', root);
    expect(root.calls).toEqual([['dark', true]]);
  });

  it('removes the dark class for light', () => {
    const root = fakeRoot();
    applyTheme('light', root);
    expect(root.calls).toEqual([['dark', false]]);
  });

  it('does nothing without a document', () => {
    expect(() => applyTheme('dark')).not.toThrow();
  });
});

describe('writeThemeCookie', () => {
  it('does nothing without a document', () => {
    expect(() => writeThemeCookie('light')).not.toThrow();
  });
});
