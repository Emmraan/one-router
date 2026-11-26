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

function readManifest(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function checkBuildOutput(appDir = 'apps/web') {
  const nextDir = path.join(appDir, '.next');
  const checks = [];

  const buildIdFile = path.join(nextDir, 'BUILD_ID');
  let buildId = '';
  try {
    buildId = readFileSync(buildIdFile, 'utf8').trim();
  } catch {
    buildId = '';
  }
  checks.push({
    name: 'build-id',
    ok: buildId.length > 0,
    detail: buildId.length > 0 ? buildId : 'missing .next/BUILD_ID',
  });

  const appPaths = readManifest(path.join(nextDir, 'server/app-paths-manifest.json'));
  const appBuild = readManifest(path.join(nextDir, 'app-build-manifest.json'));
  const hasAppPath = typeof appPaths?.['/page'] === 'string';
  const hasWebpackPage =
    Array.isArray(appBuild?.pages?.['/page']) && appBuild.pages['/page'].length > 0;
  checks.push({
    name: 'page-route',
    ok: hasAppPath || hasWebpackPage,
    detail: 'route /page in app-paths-manifest.json or app-build-manifest.json',
  });

  checks.push({
    name: 'page-server',
    ok: isFile(path.join(nextDir, 'server/app/page.js')),
    detail: '.next/server/app/page.js',
  });

  const standaloneEntries = [
    path.join(nextDir, 'standalone/apps/web/server.js'),
    path.join(nextDir, 'standalone/server.js'),
  ];
  checks.push({
    name: 'standalone',
    ok: standaloneEntries.some(isFile),
    detail: 'standalone server entrypoint',
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
