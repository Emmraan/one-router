import { describe, expect, it } from 'vitest';
import { checkCommands, checkLinks } from './docs-check.mjs';

const page = (source: string) => ({ 'guide.mdx': source });
const command = '```bash verify="local-version"\none-router --version\n```';
const manifest = { 'local-version': { shell: 'bash', command: 'one-router --version', test: 'cli' } };
const tests = { cli: ['local-version'] };

describe('executable documentation', () => {
  it('binds every shell fence to an exact, registered test', () => {
    expect(checkCommands(page(command), manifest, tests)).toEqual([]);
    expect(checkCommands(page(command.replace('--version', '--help')), manifest, tests).join()).toContain('command differs');
    expect(checkCommands(page(command), manifest, { cli: ['other-test'] }).join()).toContain('unknown test');
    expect(checkCommands(page(command.replace(' verify="local-version"', '')), {}, {}).join()).toContain('missing verify');
  });

  it('rejects stale entries, duplicate IDs and unpaired OS variants', () => {
    expect(checkCommands({}, manifest, tests).join()).toContain('not used');
    expect(checkCommands(page(`${command}\n\n${command}`), manifest, tests).join()).toContain('duplicate verify');
    const os = { 'local-version': { ...manifest['local-version'], variant: 'local-version-windows' } };
    expect(checkCommands(page(command), os, tests).join()).toContain('PowerShell and POSIX variants');
  });

  it('handles list-indented fences and ignores snippets inside non-command fences', () => {
    const source = `1. Check the version:\n\n   ${command.replaceAll('\n', '\n   ')}\n\n\`\`\`\`text\n${command}\n\`\`\`\``;
    expect(checkCommands(page(source), manifest, tests)).toEqual([]);
  });
});

describe('static site links', () => {
  it('resolves local directories, HTML entities, assets and URL-encoded anchors', () => {
    const files = {
      'index.html': '<a href="/docs/?a=1&amp;b=2#caf%C3%A9">Read</a><img src="/icon.svg">',
      'docs/index.html': '<h2 id="café">Café</h2><a href="../">Home</a><a href="#caf%C3%A9">Café</a>',
      'icon.svg': '',
    };
    expect(checkLinks(files, 'https://example.com')).toEqual([]);
  });

  it('reports missing same-site links and fragments without fetching external links', () => {
    const files = { 'index.html': '<a href="https://example.com/docs/">Docs</a><a href="#lost">Lost</a><a href="https://outside.example/">More</a>' };
    expect(checkLinks(files, 'https://example.com')).toHaveLength(2);
  });
});
