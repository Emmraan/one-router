import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUDGETS = {
  js: 220 * 1024,
  css: 50 * 1024,
};

function assertSafeAsset(asset) {
  if (typeof asset !== 'string' || asset.length === 0) {
    throw new Error(`Unsafe asset path: ${String(asset)}`);
  }

  const normalized = asset.replaceAll('\\', '/');
  const unsafe =
    path.isAbsolute(normalized) ||
    /^[a-zA-Z]:/.test(normalized) ||
    /^[a-z]+:\/\//i.test(normalized) ||
    normalized.split('/').includes('..');

  if (unsafe) {
    throw new Error(`Unsafe asset path: ${asset}`);
  }

  return normalized;
}

export function collectInitialAssets(manifest, route = '/page') {
  const files = manifest?.pages?.[route] ?? manifest?.pages?.['/'];

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error(`No initial assets for route ${route}`);
  }

  const js = [];
  const css = [];
  const seen = new Set();

  for (const raw of files) {
    const asset = assertSafeAsset(raw);
    if (seen.has(asset)) continue;
    seen.add(asset);

    const extension = path.extname(asset).toLowerCase();
    if (extension === '.js' || extension === '.mjs') js.push(asset);
    if (extension === '.css') css.push(asset);
  }

  if (js.length === 0 && css.length === 0) {
    throw new Error(`No JS or CSS assets for route ${route}`);
  }

  return { js, css };
}

function readAttribute(tag, name) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'),
  );
  return match ? (match[1] ?? match[2]) : null;
}

export function collectHtmlAssets(html) {
  if (typeof html !== 'string' || html.trim().length === 0) {
    throw new Error('No HTML output to measure.');
  }

  const js = [];
  const css = [];
  const seen = new Set();

  const pushAsset = (url, kind) => {
    const clean = url.split(/[?#]/, 1)[0];
    if (!clean.startsWith('/_next/')) {
      throw new Error(`Unsafe asset path: ${url}`);
    }

    const asset = assertSafeAsset(clean.slice('/_next/'.length));
    if (seen.has(asset)) return;
    seen.add(asset);

    const extension = path.extname(asset).toLowerCase();
    if (kind === 'js' && (extension === '.js' || extension === '.mjs')) js.push(asset);
    if (kind === 'css' && extension === '.css') css.push(asset);
  };

  for (const match of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const tagName = match[1].toLowerCase();

    if (tagName === 'script') {
      if (/\bnoModule\b/i.test(tag)) continue;
      const src = readAttribute(tag, 'src');
      if (src) pushAsset(src, 'js');
      continue;
    }

    const rel = (readAttribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    const href = readAttribute(tag, 'href');
    if (!href) continue;

    if (rel.includes('stylesheet')) {
      pushAsset(href, 'css');
    } else if (rel.includes('preload') && readAttribute(tag, 'as') === 'script') {
      pushAsset(href, 'js');
    }
  }

  if (js.length === 0 && css.length === 0) {
    throw new Error('No initial assets found in HTML.');
  }

  return { js, css };
}

export function gzipAssets(root, files) {
  const unique = [...new Set(files.map(assertSafeAsset))];

  const measured = unique.map((file) => {
    let buffer;
    try {
      buffer = readFileSync(path.join(root, file));
    } catch {
      throw new Error(`Asset not found: ${file}`);
    }

    return {
      file,
      bytes: buffer.length,
      gzip: gzipSync(buffer, { level: 9 }).length,
    };
  });

  return {
    files: measured,
    totalGzip: measured.reduce((total, asset) => total + asset.gzip, 0),
  };
}

export function evaluateBudget({ jsBytes, cssBytes }, budgets = BUDGETS) {
  const checks = [
    {
      id: 'NFR-15-js',
      label: 'Initial JS',
      actual: jsBytes,
      limit: budgets.js,
      ok: jsBytes <= budgets.js,
    },
    {
      id: 'NFR-15-css',
      label: 'Initial CSS',
      actual: cssBytes,
      limit: budgets.css,
      ok: cssBytes <= budgets.css,
    },
  ];

  return { ok: checks.every((check) => check.ok), checks };
}

export function measureApp(appDir = 'apps/web') {
  const nextDir = path.join(appDir, '.next');
  const candidates = [
    {
      file: path.join(nextDir, 'server/app/index.html'),
      root: nextDir,
    },
    {
      file: path.join(appDir, 'out/index.html'),
      root: path.join(appDir, 'out'),
    },
  ];

  let source = null;
  let assetRoot = null;
  let assets = null;

  for (const candidate of candidates) {
    if (!existsSync(candidate.file)) continue;
    assets = collectHtmlAssets(readFileSync(candidate.file, 'utf8'));
    source = candidate.file;
    assetRoot = candidate.root;
    break;
  }

  if (!assets) {
    const manifestPath = path.join(nextDir, 'app-build-manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error('No initial route HTML or app-build-manifest.json found. Run pnpm build first.');
    }
    assets = collectInitialAssets(JSON.parse(readFileSync(manifestPath, 'utf8')));
    source = manifestPath;
    assetRoot = nextDir;
  }

  const js = gzipAssets(assetRoot, assets.js);
  const css = gzipAssets(assetRoot, assets.css);

  return {
    nextDir,
    source,
    assets,
    js,
    css,
    evaluation: evaluateBudget({ jsBytes: js.totalGzip, cssBytes: css.totalGzip }),
  };
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  let result;
  try {
    result = measureApp(process.argv[2] ?? 'apps/web');
  } catch (error) {
    console.error(`Budget check failed: ${error.message}`);
    console.error('Run pnpm build first.');
    process.exit(1);
  }

  console.log('NFR-15 budget (gzip, initial / route)');
  for (const check of result.evaluation.checks) {
    const status = check.ok ? 'PASS' : 'FAIL';
    console.log(
      `  ${check.label.padEnd(13)} ${formatKb(check.actual).padStart(9)} / ${formatKb(check.limit).padStart(9)}  ${status}`,
    );
  }

  for (const asset of [...result.js.files, ...result.css.files]) {
    console.log(`  ${formatKb(asset.gzip).padStart(9)}  ${asset.file}`);
  }

  console.log('NFR-16/21 source boundaries run next; runtime budgets remain in P8/P10.');

  if (!result.evaluation.ok) {
    process.exit(1);
  }
}
