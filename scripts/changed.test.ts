import { describe, expect, it } from 'vitest';
import { collectChangedFiles, mapChangedFiles } from './changed.mjs';

describe('mapChangedFiles', () => {
  it.each([
    [['apps/web/app/page.tsx'], ['web']],
    [['apps/web/package.json'], ['web']],
    [['apps/site/app/page.tsx'], ['site']],
    [['scripts/budget.mjs'], ['root']],
    [['package.json'], ['root']],
    [['pnpm-lock.yaml'], ['root']],
    [['eslint.config.mjs'], ['root']],
    [['packages/core/src/index.ts'], ['package:core']],
    [['apps/web/app/page.tsx', 'scripts/budget.mjs'], ['root', 'web']],
    [['context/PLAN.md', '.github/workflows/ci.yml'], []],
  ])('maps %j to %j', (files, expected) => {
    expect(mapChangedFiles(files)).toEqual(expected);
  });

  it('normalizes Windows separators and leading ./', () => {
    expect(mapChangedFiles(['apps\\web\\app\\page.tsx', './scripts/budget.mjs'])).toEqual([
      'root',
      'web',
    ]);
  });

  it('deduplicates targets', () => {
    expect(
      mapChangedFiles(['apps/web/app/page.tsx', 'apps/web/components/sidebar.tsx']),
    ).toEqual(['web']);
  });
});

describe('collectChangedFiles', () => {
  it('collects unstaged, staged, and untracked files', () => {
    const runGit = (args: string[]) => {
      if (args.includes('--cached')) return 'scripts/budget.mjs\0';
      if (args.includes('--others')) return 'apps/web/app/page.tsx\0';
      if (args.includes('HEAD')) return 'apps/web/app/page.tsx\0';
      return '';
    };

    expect(collectChangedFiles({ runGit })).toEqual([
      'apps/web/app/page.tsx',
      'scripts/budget.mjs',
    ]);
  });

  it('falls back to the last commit when the working tree is clean', () => {
    const calls: string[][] = [];
    const runGit = (args: string[]) => {
      calls.push(args);
      if (args.includes('HEAD~1')) return 'scripts/budget.mjs\0';
      return '';
    };

    expect(collectChangedFiles({ runGit })).toEqual(['scripts/budget.mjs']);
    expect(calls.some((args) => args.includes('HEAD~1'))).toBe(true);
  });

  it('returns no files when there is no parent commit', () => {
    const runGit = () => '';
    expect(collectChangedFiles({ runGit })).toEqual([]);
  });
});
