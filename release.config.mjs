export function createReleaseConfig(hasNpmToken) {
  return {
    branches: ['main'],
    tagFormat: 'v${version}',
    plugins: [
      '@semantic-release/commit-analyzer',
      '@semantic-release/release-notes-generator',
      ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md' }],
      ['@semantic-release/npm', { pkgRoot: 'packages/cli', npmPublish: hasNpmToken, tarballDir: 'release-artifacts' }],
      ['@semantic-release/github', { assets: ['release-artifacts/*.tgz'] }],
      ['@semantic-release/git', { assets: ['CHANGELOG.md', 'packages/cli/package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}' }],
    ],
  };
}

export default createReleaseConfig(Boolean(process.env.NPM_TOKEN));
