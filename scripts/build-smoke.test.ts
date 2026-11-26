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
  writeFile(root, 'out/index.html', '<!doctype html><script src="/_next/static/chunks/a.js"></script>');
  writeFile(root, 'out/login/index.html', '<!doctype html>');
  writeFile(root, 'out/change-password/index.html', '<!doctype html>');
  writeFile(root, 'out/_next/static/chunks/a.js');
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('checkBuildOutput', () => {
  it('passes a healthy static export', () => {
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

  it('fails when the export index is missing', () => {
    const root = makeApp();
    writeHealthyBuild(root);
    rmSync(path.join(root, 'out/index.html'));

    const result = checkBuildOutput(root);

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === 'export-index')).toMatchObject({
      ok: false,
    });
  });

  it('fails when an auth route is missing', () => {
    const root = makeApp();
    writeHealthyBuild(root);
    rmSync(path.join(root, 'out/login/index.html'));
    rmSync(path.join(root, 'out/change-password/index.html'));

    const result = checkBuildOutput(root);

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === 'export-login')).toMatchObject({
      ok: false,
    });
    expect(result.checks.find((check) => check.name === 'export-change-password')).toMatchObject({
      ok: false,
    });
  });

  it('fails when the asset directory is missing', () => {
    const root = makeApp();
    writeHealthyBuild(root);
    rmSync(path.join(root, 'out/_next'), { recursive: true, force: true });

    const result = checkBuildOutput(root);

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === 'export-assets')).toMatchObject({
      ok: false,
    });
  });

  it('fails when the index has no client script', () => {
    const root = makeApp();
    writeHealthyBuild(root);
    writeFile(root, 'out/index.html', '<!doctype html><p>static</p>');

    const result = checkBuildOutput(root);

    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.name === 'index-scripts')).toMatchObject({
      ok: false,
    });
  });
});
