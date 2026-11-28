import { describe, expect, it } from 'vitest';
import { mergeSettings, printableSettings, parseSettings } from './config';

describe('CLI settings', () => {
  it('merges documented keys with environment overrides and redacts secrets and URL values', () => {
    const stored = parseSettings(JSON.stringify({ PORT: 3100, OPENAI_API_KEY: 'fixture-key',
      TURSO_DATABASE_URL: 'libsql://example.test?token=fixture-token', ONE_ROUTER_SESSION_DAYS: 20 }));
    const effective = mergeSettings(stored, { PORT: '3101', S3_SECRET_ACCESS_KEY: 'fixture-secret',
      ONE_ROUTER_ALLOWED_ORIGINS: 'http://localhost:3101' });
    expect(printableSettings(effective)).toEqual({ PORT: '3101', OPENAI_API_KEY: '[redacted]',
      TURSO_DATABASE_URL: '[redacted]', ONE_ROUTER_SESSION_DAYS: '20', S3_SECRET_ACCESS_KEY: '[redacted]',
      ONE_ROUTER_ALLOWED_ORIGINS: 'http://localhost:3101' });
  });

  it.each(['null', '[]', '{"NODE_ENV":"production"}', '{"PORT":true}', '{"__proto__":"bad"}'])(
    'reports invalid settings without echoing input: %s', (text) => {
      expect(() => parseSettings(text)).toThrow('Invalid CLI configuration');
    },
  );
});
