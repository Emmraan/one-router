import { describe, expect, it } from 'vitest';
import { loadEnv, maxUploadBytes } from './env';

const base = { NODE_ENV: 'development', ONE_ROUTER_DATA_DIR: 'C:/data/one-router' };

describe('server environment', () => {
  it('provides development defaults', () => {
    const env = loadEnv(base);
    expect(env.databaseUrl).toContain('one-router.db');
    expect(env.allowedOrigins).toEqual(['http://localhost:3000', 'http://localhost:4000']);
    expect(env.sessionDays).toBe(30);
    expect(env.storage).toBe('sqlite');
    expect(env.maxFiles).toBe(10);
  });

  it('requires a database URL in production and disables implicit origins', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow('TURSO_DATABASE_URL');
    const env = loadEnv({ NODE_ENV: 'production', TURSO_DATABASE_URL: 'libsql://example.turso.io' });
    expect(env.production).toBe(true);
    expect(env.allowedOrigins).toEqual([]);
    expect(env.storage).toBe('filesystem');
  });

  it('validates origins and numeric limits', () => {
    expect(() => loadEnv({ ...base, ONE_ROUTER_ALLOWED_ORIGINS: 'https://app.example.com/path' })).toThrow('origins');
    expect(() => loadEnv({ ...base, ONE_ROUTER_ALLOWED_ORIGINS: 'file:///etc/passwd' })).toThrow('origins');
    expect(() => loadEnv({ ...base, ONE_ROUTER_SESSION_DAYS: '0' })).toThrow('ONE_ROUTER_SESSION_DAYS');
    expect(() => loadEnv({ ...base, ONE_ROUTER_MAX_FILE_MB: '11' })).toThrow('ONE_ROUTER_MAX_FILE_MB');
    expect(() => loadEnv({ ...base, ONE_ROUTER_MAX_FILES: '101' })).toThrow('ONE_ROUTER_MAX_FILES');
  });

  it('rejects weak bootstrap secrets', () => {
    expect(() => loadEnv({ ...base, INITIAL_PASSWORD: 'short' })).toThrow('INITIAL_PASSWORD');
    expect(() => loadEnv({ ...base, ONE_ROUTER_AUTH_TOKEN: 'short' })).toThrow('ONE_ROUTER_AUTH_TOKEN');
  });

  it('selects and validates S3 configuration', () => {
    const env = loadEnv({
      ...base,
      S3_ENDPOINT: 'https://s3.example.com',
      S3_REGION: 'eu-west-1',
      S3_BUCKET: 'one-router-files',
      S3_ACCESS_KEY_ID: 'access',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_FORCE_PATH_STYLE: 'true',
    });
    expect(env.storage).toBe('s3');
    expect(env.s3?.bucket).toBe('one-router-files');
    expect(env.s3?.forcePathStyle).toBe(true);
    expect(() => loadEnv({ ...base, S3_BUCKET: 'only-bucket' })).toThrow('S3 storage requires');
    expect(loadEnv({ ...base, VERCEL: '1' }).storage).toBe('s3');
  });

  it('caps uploads at the attachment table limit', () => {
    const env = loadEnv({ ...base, ONE_ROUTER_MAX_FILE_MB: '10' });
    expect(maxUploadBytes(env)).toBe(10 * 1024 * 1024);
  });
});