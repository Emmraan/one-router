import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BUDGETS,
  collectHtmlAssets,
  collectInitialAssets,
  evaluateBudget,
  gzipAssets,
  measureApp,
} from './budget.mjs';

const roots: string[] = [];

function makeRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'onerouter-budget-'));
  roots.push(root);
  return root;
}

function writeAsset(root: string, file: string, content: string) {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('collectInitialAssets', () => {
  it('splits and deduplicates JS and CSS for the page route', () => {
    const manifest = {
      pages: {
        '/page': [
          'static/chunks/a.js',
          'static/css/a.css',
          'static/chunks/a.js',
          'static/chunks/b.js',
        ],
      },
    };

    expect(collectInitialAssets(manifest)).toEqual({
      js: ['static/chunks/a.js', 'static/chunks/b.js'],
      css: ['static/css/a.css'],
    });
  });

  it('falls back to the root route key', () => {
    expect(collectInitialAssets({ pages: { '/': ['static/chunks/root.js'] } })).toEqual({
      js: ['static/chunks/root.js'],
      css: [],
    });
  });

  it('throws when the route has no assets', () => {
    expect(() => collectInitialAssets({ pages: {} })).toThrow(/no initial assets/i);
  });

  it.each([
    '../secret.js',
    '/static/chunks/a.js',
    'http://evil.test/a.js',
    'static/../../secret.js',
    'C:/secret.js',
  ])('rejects unsafe asset path %s', (asset) => {
    expect(() => collectInitialAssets({ pages: { '/page': [asset] } })).toThrow(
      /unsafe/i,
    );
  });
});

describe('collectHtmlAssets', () => {
  it('collects local scripts, preloaded scripts, and stylesheets', () => {
    const html = `
      <link rel="stylesheet" href="/_next/static/chunks/app.css" />
      <link rel="preload" as="script" href="/_next/static/chunks/preload.js" />
      <link rel="preload" as="font" href="/_next/static/media/font.woff2" />
      <script src="/_next/static/chunks/a.js" async></script>
      <script src="/_next/static/chunks/a.js"></script>
      <script>inline()</script>
    `;

    expect(collectHtmlAssets(html)).toEqual({
      js: ['static/chunks/preload.js', 'static/chunks/a.js'],
      css: ['static/chunks/app.css'],
    });
  });

  it('ignores legacy nomodule scripts', () => {
    const html = [
      '<script src="/_next/static/chunks/modern.js"></script>',
      '<script src="/_next/static/chunks/legacy.js" noModule></script>',
    ].join('');

    expect(collectHtmlAssets(html).js).toEqual(['static/chunks/modern.js']);
  });

  it('rejects external and traversal asset URLs', () => {
    expect(() =>
      collectHtmlAssets('<script src="https://evil.test/a.js"></script>'),
    ).toThrow(/unsafe/i);
    expect(() =>
      collectHtmlAssets('<script src="/_next/../secret.js"></script>'),
    ).toThrow(/unsafe/i);
  });

  it('throws when there are no assets', () => {
    expect(() => collectHtmlAssets('<html><body>empty</body></html>')).toThrow(
      /no initial assets/i,
    );
  });
});

describe('measureApp', () => {
  it('prefers the prerendered route HTML', () => {
    const root = makeRoot();
    writeAsset(root, '.next/server/app/index.html', [
      '<link rel="stylesheet" href="/_next/static/chunks/app.css" />',
      '<script src="/_next/static/chunks/a.js"></script>',
    ].join(''));
    writeAsset(root, '.next/static/chunks/a.js', 'console.log(1)');
    writeAsset(root, '.next/static/chunks/app.css', 'body{}');

    const result = measureApp(root);

    expect(result.assets).toEqual({
      js: ['static/chunks/a.js'],
      css: ['static/chunks/app.css'],
    });
    expect(result.evaluation.ok).toBe(true);
  });

  it('falls back to the webpack app-build-manifest', () => {
    const root = makeRoot();
    writeAsset(
      root,
      '.next/app-build-manifest.json',
      JSON.stringify({ pages: { '/page': ['static/chunks/a.js'] } }),
    );
    writeAsset(root, '.next/static/chunks/a.js', 'console.log(1)');

    const result = measureApp(root);

    expect(result.assets.js).toEqual(['static/chunks/a.js']);
    expect(result.assets.css).toEqual([]);
  });

  it('fails when no build output exists', () => {
    const root = makeRoot();
    expect(() => measureApp(root)).toThrow(/run pnpm build/i);
  });
});

describe('gzipAssets', () => {
  it('sums gzip sizes for the initial files', () => {
    const root = makeRoot();
    const content = 'a'.repeat(1000);
    writeAsset(root, 'static/chunks/a.js', content);

    const result = gzipAssets(root, ['static/chunks/a.js']);

    expect(result.totalGzip).toBe(gzipSync(Buffer.from(content)).length);
    expect(result.files).toEqual([
      {
        file: 'static/chunks/a.js',
        bytes: Buffer.byteLength(content),
        gzip: gzipSync(Buffer.from(content)).length,
      },
    ]);
  });

  it('throws when an asset is missing', () => {
    const root = makeRoot();
    expect(() => gzipAssets(root, ['static/chunks/missing.js'])).toThrow(/not found/i);
  });
});

describe('evaluateBudget', () => {
  it('passes at the exact limit', () => {
    const result = evaluateBudget({
      jsBytes: BUDGETS.js,
      cssBytes: BUDGETS.css,
    });

    expect(result.ok).toBe(true);
    expect(result.checks.map((check) => check.ok)).toEqual([true, true]);
  });

  it('fails one byte over the JS limit', () => {
    const result = evaluateBudget({ jsBytes: BUDGETS.js + 1, cssBytes: 0 });

    expect(result.ok).toBe(false);
    expect(result.checks[0]).toMatchObject({ id: 'NFR-15-js', ok: false });
  });

  it('fails one byte over the CSS limit', () => {
    const result = evaluateBudget({ jsBytes: 0, cssBytes: BUDGETS.css + 1 });

    expect(result.ok).toBe(false);
    expect(result.checks[1]).toMatchObject({ id: 'NFR-15-css', ok: false });
  });
});
