import { readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import manifest from './docs-commands.json' with { type: 'json' };

const shellNames = new Set(['bash', 'sh', 'shell', 'zsh', 'console', 'shell-session', 'powershell', 'pwsh', 'ps1', 'bat', 'cmd', 'fish', 'ksh']);
const testFiles = {
  cli: 'scripts/cli-smoke.mjs',
  compose: 'scripts/docker-smoke.sh',
  systemd: 'scripts/systemd-smoke.sh',
  workspace: '.github/workflows/ci.yml',
};

function registeredCommandTests() {
  return Object.fromEntries(Object.entries(testFiles).map(([suite, path]) => [suite,
    Array.from(readFileSync(path, 'utf8').matchAll(/\bdocCommand\('([a-z0-9-]+)'\)|\bdoc_command ([a-z0-9-]+)/g),
      ([, js, shell]) => js ?? shell),
  ]));
}

export function checkCommands(pages, commands, registeredTests) {
  const errors = [];
  const used = new Set();

  for (const [path, source] of Object.entries(pages)) {
    let fence;
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      const marker = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
      if (!fence) {
        if (!marker) continue;
        const [, indent, delimiter, info] = marker;
        const [shell] = info.trim().split(/\s+/, 1);
        fence = { indent, delimiter, shell, id: /(?:^|\s)verify="([a-z0-9-]+)"(?=\s|$)/.exec(info)?.[1], lines: [], start: index + 1 };
      } else if (marker && !marker[3].trim() && marker[2][0] === fence.delimiter[0] && marker[2].length >= fence.delimiter.length) {
        const { shell, id, lines, start } = fence;
        fence = undefined;
        if (!shellNames.has(shell) && !id) continue;
        const label = `${path}:${start}`;
        if (!id) {
          errors.push(`${label}: missing verify ID`);
          continue;
        }
        if (used.has(id)) errors.push(`${label}: duplicate verify ID ${id}`);
        used.add(id);
        const entry = Object.hasOwn(commands, id) ? commands[id] : undefined;
        if (!entry) {
          errors.push(`${label}: unknown verify ID ${id}`);
          continue;
        }
        if (!Object.hasOwn(registeredTests, entry.test) || !registeredTests[entry.test].includes(id)) {
          errors.push(`${label}: unknown test ${entry.test}/${id}`);
        }
        if (entry.shell !== shell || entry.command !== lines.join('\n').trim()) errors.push(`${label}: command differs from ${id}`);
      } else {
        fence.lines.push(line.startsWith(fence.indent) ? line.slice(fence.indent.length) : line);
      }
    }
    if (fence) errors.push(`${path}:${fence.start}: unclosed fence`);
  }

  for (const [id, entry] of Object.entries(commands)) {
    if (!used.has(id)) errors.push(`${id}: manifest entry not used`);
    if (entry.variant || entry.shell === 'powershell') {
      const alternate = commands[entry.variant];
      const shells = [entry.shell, alternate?.shell].sort().join(',');
      if (alternate?.variant !== id || shells !== 'bash,powershell' || alternate.test !== entry.test) {
        errors.push(`${id}: link reciprocal PowerShell and POSIX variants in the same test`);
      }
    }
  }
  return errors;
}

function inspectHtml(html) {
  const anchors = new Set();
  const links = [];
  function visit(node) {
    for (const { name, value } of node.attrs ?? []) {
      if (name === 'id' || (name === 'name' && node.tagName === 'a')) anchors.add(value);
      if (name === 'href' || name === 'src' || (node.tagName === 'meta' && name === 'content' &&
        node.attrs.some(({ value }) => ['og:url', 'og:image', 'twitter:image'].includes(value)))) links.push(value);
    }
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(parse(html));
  return { anchors, links };
}

export function checkLinks(files, siteUrl) {
  const errors = [];
  const html = new Map(Object.entries(files).filter(([name]) => name.endsWith('.html'))
    .map(([name, data]) => [name, inspectHtml(data)]));
  const origin = new URL(siteUrl).origin;
  for (const [name, { links }] of html) {
    const base = new URL(`/${name.replace(/(^|\/)index\.html$/, '$1')}`, origin);
    for (const href of new Set(links)) {
      let url;
      let path;
      let anchor;
      try {
        url = new URL(href, base);
        if (url.origin !== origin) continue;
        path = decodeURIComponent(url.pathname).slice(1);
        anchor = decodeURIComponent(url.hash.slice(1));
      } catch {
        errors.push(`${name}: invalid URL ${href}`);
        continue;
      }
      const target = [path, posix.join(path, 'index.html'), `${path}.html`].find((candidate) => Object.hasOwn(files, candidate));
      if (!target) errors.push(`${name}: missing target ${href}`);
      else if (anchor && html.has(target) && !html.get(target).anchors.has(anchor)) errors.push(`${name}: missing anchor ${href}`);
    }
  }
  return errors;
}

function filesUnder(folder, predicate, read) {
  return Object.fromEntries(readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`.slice(folder.length + 1).replaceAll('\\', '/'))
    .filter(predicate).map((name) => [name, read(name) ? readFileSync(`${folder}/${name}`, 'utf8') : '']));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const docs = filesUnder('apps/site/content/docs', (name) => /\.mdx?$/.test(name), () => true);
  const errors = checkCommands(docs, manifest, registeredCommandTests());
  if (!process.argv.includes('--commands-only')) {
    const site = filesUnder('apps/site/out', () => true, (name) => name.endsWith('.html'));
    const siteUrl = /<link rel="canonical" href="([^"/]+:\/\/[^"/]+)\//.exec(site['index.html'])?.[1];
    if (!siteUrl) errors.push('Missing absolute canonical URL for the landing page');
    else errors.push(...checkLinks(site, siteUrl));
    for (const asset of ['docs/index.html', 'docs/search.json', 'sitemap.xml', 'robots.txt']) {
      if (!Object.hasOwn(site, asset)) errors.push(`Missing static export: ${asset}`);
    }
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`Verified ${Object.keys(manifest).length} command blocks across ${Object.keys(docs).length} docs pages.`);
  }
}
