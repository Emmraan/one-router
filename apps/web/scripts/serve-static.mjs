// Serves the static export for local use and the browser E2E run. API traffic
// is proxied to the Hono server so cookies stay same-origin, matching how the
// CLI serves the app.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, join, normalize, resolve, sep } from 'node:path';

const port = Number(process.env.PORT ?? 3000);
const outDir = resolve(process.env.OUT_DIR ?? 'out');
const apiOrigin = new URL(process.env.ONE_ROUTER_API_ORIGIN ?? 'http://localhost:4000');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const proxiedPrefixes = ['/api/', '/v1/', '/health', '/openapi.json'];

function isProxied(pathname) {
  return proxiedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function proxy(req, res) {
  const target = new URL(req.url ?? '/', apiOrigin);
  const transport = target.protocol === 'https:' ? httpsRequest : httpRequest;
  const upstream = transport(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.setTimeout(0);
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('API unavailable');
  });
  req.pipe(upstream);
}

function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = join(outDir, relative);
  if (candidate !== outDir && !candidate.startsWith(outDir + sep)) return null;

  const attempts = [];
  if (relative === '' || decoded.endsWith('/')) {
    attempts.push(join(candidate, 'index.html'));
  } else {
    attempts.push(candidate);
    attempts.push(join(candidate, 'index.html'));
    if (!extname(candidate)) attempts.push(`${candidate}.html`);
  }
  return attempts.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
}

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (isProxied(pathname)) {
    proxy(req, res);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end();
    return;
  }
  const file = resolveFile(pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const immutable = file.includes(`${sep}_next${sep}static${sep}`);
  res.writeHead(200, {
    'content-type': contentTypes[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    // Script CSP belongs to the final CLI host, which knows the export's inline
    // bootstrap hashes. These directives are safe for static HTML as-is.
    'content-security-policy': "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log(`Static export on http://localhost:${port} (API ${apiOrigin.origin})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
