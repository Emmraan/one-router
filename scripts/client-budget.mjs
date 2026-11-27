import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const heavy = /^(?:katex|mermaid|highlight\.js|motion|framer-motion)(?:\/|$)/;
const remote = /(?:cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|next\/font\/google)/;

export function auditClientSources(files, entries) {
  const findings = [];
  const visited = new Set();
  const resolve = (file, specifier) => {
    let base;
    if (specifier.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    else if (specifier.startsWith('@/')) base = `apps/web/${specifier.slice(2)}`;
    else if (specifier.startsWith('@one-router/ui/')) {
      const subpath = specifier.slice('@one-router/ui/'.length);
      const aliases = { brand: 'brand/network-mark', dialog: 'primitives/dialog', workspace: 'primitives/workspace', utils: 'utils' };
      base = `packages/ui/src/${aliases[subpath] ?? subpath}`;
    } else return null;
    return [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) => candidate in files);
  };
  const visit = (file) => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = files[file] ?? '';
    const imports = /(?:^|[;\n])\s*(?:import|export)\s+(?!type\b)(?:[^;'"()]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(imports)) {
      const specifier = match[1];
      if (heavy.test(specifier)) findings.push(`${file}: initial static import ${specifier}`);
      const target = resolve(file, specifier);
      if (target) visit(target);
    }
  };
  for (const [file, source] of Object.entries(files)) if (remote.test(source)) findings.push(`${file}: remote runtime asset`);
  for (const entry of entries) visit(entry);
  return { ok: findings.length === 0, findings, initialSourceCount: visited.size };
}

export function measureClientSources() {
  const files = {};
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!['node_modules', '.next', 'out', 'e2e', 'test-results'].includes(entry.name)) walk(file);
      } else if (/\.(tsx?|css)$/.test(file) && !/\.(test|config)\./.test(file) && !file.endsWith('.d.ts')) files[file] = readFileSync(file, 'utf8');
    }
  };
  for (const directory of ['apps/web/app', 'apps/web/components', 'apps/web/hooks', 'apps/web/lib', 'packages/ui/src']) walk(directory);
  const entries = Object.keys(files).filter((file) => /^apps\/web\/app\/.*(?:page|layout)\.tsx$/.test(file));
  return auditClientSources(files, entries);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = measureClientSources();
  console.log(`NFR-16/21: local lazy renderers, no initial JS animation library: ${result.ok ? 'PASS' : 'FAIL'} (${result.initialSourceCount} initial source files)`);
  for (const finding of result.findings) console.error(finding);
  if (!result.ok) process.exitCode = 1;
}
