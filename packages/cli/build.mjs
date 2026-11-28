import { chmod, copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import manifest from './package.json' with { type: 'json' };

const root = fileURLToPath(new URL('.', import.meta.url));
const dist = new URL('./dist/', import.meta.url);
const web = new URL('../../apps/web/out/', import.meta.url);
const migrations = new URL('../db/src/migrations/', import.meta.url);

await rm(dist, { force: true, recursive: true });
await mkdir(dist);
await build({
  absWorkingDir: root,
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  splitting: true,
  platform: 'node',
  target: 'node24',
  define: { CLI_VERSION: JSON.stringify(manifest.version) },
  // Leave the native libSQL loader and PDF worker in their own packages.
  external: Object.keys(manifest.dependencies),
  legalComments: 'linked',
});
const entry = new URL('index.js', dist);
await writeFile(entry, `#!/usr/bin/env node\n${await readFile(entry, 'utf8')}`);
await chmod(entry, 0o755);
await Promise.all([
  cp(web, new URL('web/', dist), { recursive: true }),
  cp(migrations, new URL('migrations/', dist), { recursive: true }),
  copyFile(new URL('../../LICENSE', import.meta.url), new URL('LICENSE', dist)),
]);
