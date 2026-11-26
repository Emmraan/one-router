import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/ci-run.mjs <command> [...args]');
  process.exit(2);
}

const label = [command, ...args].join(' ');
const logDir = path.join(process.cwd(), '.ci-logs');
const slug = label.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80);
const logFile = path.join(logDir, `${slug}.log`);

mkdirSync(logDir, { recursive: true });

const chunks = [];
const child =
  process.platform === 'win32'
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', label], {
        cwd: process.cwd(),
        env: process.env,
      })
    : spawn('sh', ['-c', label], {
        cwd: process.cwd(),
        env: process.env,
      });

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  chunks.push(chunk);
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  chunks.push(chunk);
});

child.on('close', (code) => {
  const output = Buffer.concat(chunks);
  writeFileSync(logFile, output);

  if (code !== 0) {
    console.error(`\nCommand failed: ${label}`);
    console.error('Last 40 lines:');
    const lines = output.toString('utf8').split(/\r?\n/);
    console.error(lines.slice(-40).join('\n'));
    process.exit(code ?? 1);
  }
});
