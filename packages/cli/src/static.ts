import { openAsBlob } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pagePolicy } from '@one-router/server/static-policy';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

export async function createStaticHandler(root: string, production: boolean) {
  const files = new Map<string, { filename: string; type: string; policy?: string; html?: string }>();
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    const type = types[extname(entry.name)];
    if (!entry.isFile() || !type) continue;
    const filename = join(entry.parentPath, entry.name);
    const route = `/${filename.slice(root.length).replaceAll('\\', '/').replace(/^\//, '')}`;
    const html = type.startsWith('text/html') ? await readFile(filename, 'utf8') : undefined;
    files.set(route, { filename, type, html, policy: html === undefined ? undefined : pagePolicy(html) });
  }
  if (!files.has('/index.html')) throw new Error('UI export is missing');

  return async (request: Request): Promise<Response> => {
    const headers = new Headers({
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    });
    if (production) headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    const head = request.method === 'HEAD';
    if (!head && request.method !== 'GET') {
      headers.set('Allow', 'GET, HEAD');
      return new Response('Method not allowed', { status: 405, headers });
    }
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response(null, { status: 400, headers });
    }
    const file = files.get(path) ?? files.get(`${path.replace(/\/$/, '')}/index.html`);
    if (!file) return new Response(head ? null : 'Not found', { status: 404, headers });
    headers.set('Content-Type', file.type);
    if (file.policy) headers.set('Content-Security-Policy', file.policy);
    if (path.startsWith('/_next/static/')) headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(head ? null : file.html ?? await openAsBlob(file.filename), { headers });
  };
}
