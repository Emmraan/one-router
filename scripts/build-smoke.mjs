import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function isDir(file) {
  try {
    return statSync(file).isDirectory();
  } catch {
    return false;
  }
}

export function checkBuildOutput(appDir = 'apps/web') {
  const outDir = path.join(appDir, 'out');
  const checks = [];

  let buildId = '';
  try {
    buildId = readFileSync(path.join(appDir, '.next', 'BUILD_ID'), 'utf8').trim();
  } catch {
    buildId = '';
  }
  checks.push({
    name: 'build-id',
    ok: buildId.length > 0,
    detail: buildId.length > 0 ? buildId : 'missing .next/BUILD_ID',
  });

  checks.push({
    name: 'export-index',
    ok: isFile(path.join(outDir, 'index.html')),
    detail: 'out/index.html',
  });

  checks.push({
    name: 'export-login',
    ok: isFile(path.join(outDir, 'login', 'index.html')),
    detail: 'out/login/index.html',
  });

  checks.push({
    name: 'export-change-password',
    ok: isFile(path.join(outDir, 'change-password', 'index.html')),
    detail: 'out/change-password/index.html',
  });

  checks.push({
    name: 'export-assets',
    ok: isDir(path.join(outDir, '_next')),
    detail: 'out/_next assets',
  });

  let hasScript = false;
  try {
    const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
    hasScript = /<script[^>]+src=/.test(html);
  } catch {
    hasScript = false;
  }
  checks.push({
    name: 'index-scripts',
    ok: hasScript,
    detail: 'out/index.html references a client script',
  });

  return { ok: checks.every((check) => check.ok), checks };
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  const result = checkBuildOutput(process.argv[2] ?? 'apps/web');

  for (const check of result.checks) {
    console.log(`  ${check.ok ? 'PASS' : 'FAIL'}  ${check.name}  ${check.detail}`);
  }

  if (!result.ok) {
    console.error('Build smoke check failed.');
    process.exit(1);
  }

  console.log('Build smoke check passed.');
}