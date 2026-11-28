import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStaticHandler } from './static';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'one-router-static-'));
  await mkdir(join(dir, 'login'));
  await mkdir(join(dir, '_next', 'static'), { recursive: true });
  await writeFile(join(dir, 'index.html'), '<script>hello()</script>');
  await writeFile(join(dir, 'login', 'index.html'), '<p>Login</p>');
  await writeFile(join(dir, '_next', 'static', 'asset.js'), 'hello()');
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('static export hosting', () => {
  it('serves the exported routes and hashes inline scripts in the CSP', async () => {
    const serve = await createStaticHandler(dir, false);
    const page = await serve(new Request('http://localhost/'));
    expect(await page.text()).toContain('<script>hello()</script>');
    expect(page.headers.get('content-security-policy')).toMatch(/script-src 'self' 'sha256-[^']+';/);
    const scriptPolicy = page.headers.get('content-security-policy')?.split(';').find((part) => part.trim().startsWith('script-src'));
    expect(scriptPolicy).not.toContain("'unsafe-inline'");
    expect(scriptPolicy).not.toContain("'unsafe-eval'");
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(page.headers.get('x-content-type-options')).toBe('nosniff');
    const login = await serve(new Request('http://localhost/login', { method: 'HEAD' }));
    expect(login.status).toBe(200);
    expect(login.headers.get('content-type')).toContain('text/html');
    expect(await login.text()).toBe('');
  });

  it('caches immutable assets and returns 404 for missing files', async () => {
    const serve = await createStaticHandler(dir, false);
    const asset = await serve(new Request('http://localhost/_next/static/asset.js'));
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect(await asset.text()).toBe('hello()');
    expect((await serve(new Request('http://localhost/missing'))).status).toBe(404);
  });

  it('emits HSTS only for production hosting', async () => {
    const production = await createStaticHandler(dir, true);
    const local = await createStaticHandler(dir, false);
    expect((await production(new Request('https://router.example/'))).headers.get('strict-transport-security'))
      .toBe('max-age=31536000; includeSubDomains');
    expect((await local(new Request('http://localhost/'))).headers.get('strict-transport-security')).toBeNull();
  });
});
