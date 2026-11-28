import { describe, expect, it } from 'vitest';
import { createReleaseConfig } from '../release.config.mjs';

describe('release configuration', () => {
  it.each([false, true])('publishes only the CLI when npm credentials exist: %s', (hasNpmToken) => {
    const config = createReleaseConfig(hasNpmToken);
    expect(config.branches).toEqual(['main']);
    expect(config.tagFormat).toBe('v${version}');
    expect(config.plugins).toContainEqual(['@semantic-release/npm', {
      pkgRoot: 'packages/cli', npmPublish: hasNpmToken, tarballDir: 'release-artifacts',
    }]);
    expect(config.plugins).toContainEqual(['@semantic-release/git', {
      assets: ['CHANGELOG.md', 'packages/cli/package.json'],
      message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
    }]);
    expect(config.plugins).toContainEqual(['@semantic-release/github', {
      assets: ['release-artifacts/*.tgz'],
    }]);
  });
});
