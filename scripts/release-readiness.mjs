import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const requiredReleaseChecks = [
  'Quality (Node 24)', 'Quality (Node 26)', 'Integration (temp libSQL)',
  'E2E (static export + Hono)', 'budget-web', 'visual', 'pack',
  'Installed package (ubuntu-latest)', 'Installed package (windows-latest)',
  'Installed package (macos-latest)', 'Clean node:24-alpine install',
  'budget-runtime', 'e2e-tarball', 'docker-lifecycle', 'systemd', 'vercel-preview',
];

export function releaseBlockers(checklist, checks) {
  const blockers = /^Status: Ready for release\.$/m.test(checklist) ? [] : ['Owner release sign-off is not recorded'];
  for (const name of requiredReleaseChecks) {
    const check = checks.find((item) => item.name === name);
    if (check?.status !== 'completed' || check.conclusion !== 'success') blockers.push(name);
  }
  return blockers;
}

async function main() {
  const { GITHUB_REPOSITORY: repository, GITHUB_SHA: sha, GITHUB_TOKEN: token } = process.env;
  if (!repository || !sha || !token) throw new Error('Release verification requires GitHub repository, revision and token');
  const checks = [];
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`https://api.github.com/repos/${repository}/commits/${sha}/check-runs?filter=latest&per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Could not verify required release checks');
    const result = await response.json();
    checks.push(...result.check_runs);
    if (result.check_runs.length < 100) break;
    if (page === 10) throw new Error('Too many checks to verify safely');
  }
  const blockers = releaseBlockers(await readFile(new URL('../context/RELEASE.md', import.meta.url), 'utf8'), checks);
  if (blockers.length) throw new Error(`Release blocked: ${blockers.join(', ')}`);
  console.log('Owner sign-off and all required checks verified for this revision.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
