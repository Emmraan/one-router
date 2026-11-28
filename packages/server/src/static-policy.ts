import { createHash } from 'node:crypto';

export function pagePolicy(html: string) {
  const hashes = new Set<string>();
  for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (script) hashes.add(`'sha256-${createHash('sha256').update(script.replace(/\r\n?/g, '\n')).digest('base64')}'`);
  }
  return ["default-src 'none'", ["script-src 'self'", ...hashes].join(' '),
    "style-src 'self' 'unsafe-inline'", "connect-src 'self'", "img-src 'self' blob: data:",
    "font-src 'self'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'"].join('; ');
}
