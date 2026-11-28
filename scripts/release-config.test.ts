import { describe, expect, it } from 'vitest';
import { createReleaseConfig } from '../release.config.mjs';
import cliManifest from '../packages/cli/package.json';

describe('release configuration', () => {
  it('rebuilds the CLI after semantic-release writes its version and before packing', () => {
    expect(cliManifest.scripts).toHaveProperty('prepack', 'node build.mjs');
  });

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
