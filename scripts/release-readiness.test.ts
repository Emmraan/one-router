import { describe, expect, it } from 'vitest';
import { releaseBlockers, requiredReleaseChecks } from './release-readiness.mjs';

const signedOff = 'Status: Ready for release.\nOwner sign-off recorded below.';
const green = (): Array<{ name: string; status: string; conclusion: string | null }> =>
  requiredReleaseChecks.map((name) => ({ name, status: 'completed', conclusion: 'success' }));

describe('release evidence gate', () => {
  it('requires an explicit ready marker even when all checks are green', () => {
    expect(releaseBlockers('Status: Phase 10 in progress. **Release blocked.**', green()))
      .toContain('Owner release sign-off is not recorded');
  });

  it('accepts only signed-off evidence with every required check successful', () => {
    expect(releaseBlockers(signedOff, green())).toEqual([]);
    expect(releaseBlockers(signedOff, green().slice(1))).toContain(requiredReleaseChecks[0]);
  });

  it.each(['skipped', 'failure', 'cancelled', 'neutral', null])('does not count %s as success', (conclusion) => {
    const checks = green();
    checks[0] = { ...checks[0], conclusion };
    expect(releaseBlockers(signedOff, checks)).toContain(requiredReleaseChecks[0]);
  });

  it('rejects an in-progress check even if a conclusion is present', () => {
    const checks = green();
    checks[0].status = 'in_progress';
    expect(releaseBlockers(signedOff, checks)).toContain(requiredReleaseChecks[0]);
  });
});
