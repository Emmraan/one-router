import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBuildOutput } from './build-smoke.mjs';

const roots: string[] = [];

function makeApp() {
  const root = mkdtempSync(path.join(tmpdir(), 'onerouter-build-'));
  roots.push(root);
  return root;
}

function writeFile(root: string, file: string, content = 'x') {
  const target = path.join(root, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function writeHealthyBuild(root: string) {
  writeFile(root, '.next/BUILD_ID', 'test-build');
  writeFile(
    root,
    '.next/server/app-paths-manifest.json',
    JSON.stringify({ '/page': 'app/page.js' }),
  );
  writeFile(root, '.next/server/app/page.js');
  writeFile(root, '.next/standalone/apps/web/server.js');
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('checkBuildOutput', () => {
  it('passes a healthy standalone build', () => {
    const root = makeApp();
    writeHealthyBuild(root);

    const result = checkBuildOutput(root);

    expect(result.ok).toBe(true);
    expect(result.checks.every((check) => check.ok)).toBe(true);
  });

  it('fails when the build id is missing', () => {
    const root = makeApp();
    writeHealthyBuild(root);
    rmSync(path.join(root, '.next/BUILD_ID'));

    const result = checkBuildOutput(root);

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === 'build-id')).toMatchObject({
      ok: false,
    });
  });

  it('fails when the page route is missing from the manifest', () => {
    const root = makeApp();
    writeHealthyBuild(root);
    writeFile(root, '.next/server/app-paths-manifest.json', JSON.stringify({}));

    const result = checkBuildOutput(root);

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === 'page-route')).toMatchObject({
      ok: false,
    });
  });

  it('accepts the webpack app-build-manifest fallback', () => {
    const root = makeApp();
    writeHealthyBuild(root);
    writeFile(root, '.next/server/app-paths-manifest.json', JSON.stringify({}));
    writeFile(
      root,
      '.next/app-build-manifest.json',
      JSON.stringify({ pages: { '/page': ['static/chunks/a.js'] } }),
    );

    expect(checkBuildOutput(root).ok).toBe(true);
  });

  it('accepts the non-monorepo standalone entrypoint', () => {
    const root = makeApp();
    writeHealthyBuild(root);
    rmSync(path.join(root, '.next/standalone/apps'), { recursive: true, force: true });
    writeFile(root, '.next/standalone/server.js');

    expect(checkBuildOutput(root).ok).toBe(true);
  });
});
