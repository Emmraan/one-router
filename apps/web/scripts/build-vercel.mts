import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { pagePolicy } from '@one-router/server/static-policy';

const root = new URL('../', import.meta.url);
const web = new URL('out/', root);
const output = new URL('.vercel/output/', root);
const backend = new URL('functions/api/router.func/', output);

const escapeRoute = (path: string) => path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pages = (await readdir(web, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.html'));
const routes = await Promise.all(pages.map(async (entry) => {
  const directory = entry.parentPath.slice(fileURLToPath(web).length).replaceAll('\\', '/');
  const path = `/${[directory, entry.name].filter(Boolean).join('/')}`;
  const url = new URL(path.slice(1), web);
  const policy = pagePolicy(await readFile(url, 'utf8'));
  const alias = path.endsWith('/index.html') ? path.slice(0, -'/index.html'.length) : undefined;
  return {
    src: alias === undefined ? `^${escapeRoute(path)}$` : `^(?:${escapeRoute(path)}|${escapeRoute(alias)}/?)$`,
    dest: path,
    headers: { 'Content-Security-Policy': policy, 'Cache-Control': 'no-store' },
  };
}));

await rm(output, { recursive: true, force: true });
await mkdir(backend, { recursive: true });
await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['api/index.ts'],
  outfile: fileURLToPath(new URL('index.mjs', backend)),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  legalComments: 'linked',
  plugins: [{
    name: 'remote-libsql',
    setup(build) {
      // Turso over HTTPS has no need for libSQL's native SQLite binaries.
      build.onResolve({ filter: /^@libsql\/client$/ }, (args) => build.resolve('@libsql/client/web', {
        resolveDir: args.resolveDir, kind: args.kind,
      }));
    },
  }],
});

await Promise.all([
  cp(web, new URL('static/', output), { recursive: true }),
  cp(new URL('../../packages/db/src/migrations/', root), new URL('migrations/', backend), { recursive: true }),
  writeFile(new URL('.vc-config.json', backend), JSON.stringify({
    runtime: 'nodejs24.x', handler: 'index.mjs', launcherType: 'Nodejs', supportsResponseStreaming: true,
  })),
  writeFile(new URL('config.json', output), JSON.stringify({
    version: 3,
    routes: [
      { src: '/.*', headers: {
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cross-Origin-Resource-Policy': 'same-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      }, continue: true },
      { src: '^/(?:api(?:/.*)?|v1(?:/.*)?|health|openapi\\.json)$', dest: '/api/router' },
      { src: '^/_next/static/.*$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
      ...routes,
      { handle: 'filesystem' },
      { src: '/.*', dest: '/404.html', status: 404, headers: {
        'Content-Security-Policy': pagePolicy(await readFile(new URL('404.html', web), 'utf8')),
        'Cache-Control': 'no-store',
      } },
    ],
  }, null, 2)),
]);
