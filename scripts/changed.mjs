import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT_FILES = new Set([
  '.nvmrc',
  'eslint.config.mjs',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'tsconfig.json',
  'turbo.json',
  'vitest.config.ts',
]);

function splitNul(output) {
  return output
    .split('\0')
    .map((file) => file.trim())
    .filter(Boolean);
}

function defaultRunGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

export function mapChangedFiles(files) {
  const targets = new Set();

  for (const file of files) {
    const normalized = file.replaceAll('\\', '/').replace(/^\.\//, '');
    if (!normalized) continue;

    if (normalized.startsWith('apps/web/')) {
      targets.add('web');
      continue;
    }

    if (normalized.startsWith('packages/')) {
      const match = /^packages\/([^/]+)\//.exec(normalized);
      if (match) targets.add(`package:${match[1]}`);
      continue;
    }

    if (normalized.startsWith('scripts/') || ROOT_FILES.has(normalized)) {
      targets.add('root');
    }
  }

  return [...targets].sort();
}

export function collectChangedFiles({ runGit = defaultRunGit } = {}) {
  const groups = [
    ['diff', '--name-only', '-z', 'HEAD'],
    ['diff', '--name-only', '-z', '--cached'],
    ['ls-files', '--others', '--exclude-standard', '-z'],
  ];

  let files = [...new Set(groups.flatMap((args) => splitNul(runGit(args))))];

  if (files.length === 0) {
    files = [...new Set(splitNul(runGit(['diff', '--name-only', '-z', 'HEAD~1', 'HEAD'])))];
  }

  return files.sort();
}

export function planCommands(action, targets) {
  if (targets.length === 0) return [];

  if (action === 'lint') {
    return [{ command: 'eslint', args: ['.'] }];
  }

  if (action === 'typecheck') {
    const commands = [];
    if (targets.includes('web')) {
      commands.push({
        command: 'pnpm',
        args: ['--filter', '@one-router/web', 'typecheck'],
      });
    }
    for (const target of targets.filter((item) => item.startsWith('package:'))) {
      const name = target.slice('package:'.length);
      commands.push({
        command: 'pnpm',
        args: ['--filter', `./packages/${name}`, 'typecheck'],
      });
    }
    if (targets.includes('root')) {
      commands.push({ command: 'tsc', args: ['-p', 'tsconfig.json', '--noEmit'] });
    }
    return commands;
  }

  if (action === 'test') {
    return [{ command: 'vitest', args: ['run'] }];
  }

  return [];
}

function run({ command, args }) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  const action = process.argv[2];
  if (!['lint', 'typecheck', 'test'].includes(action)) {
    console.error('Usage: node scripts/changed.mjs <lint|typecheck|test>');
    process.exit(2);
  }

  const files = collectChangedFiles();
  const targets = mapChangedFiles(files);

  if (targets.length === 0) {
    console.log('No code changes; nothing to run.');
    process.exit(0);
  }

  console.log(`Changed targets: ${targets.join(', ')}`);
  for (const command of planCommands(action, targets)) {
    run(command);
  }
}
