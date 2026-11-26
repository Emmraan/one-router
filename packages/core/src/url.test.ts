import { describe, expect, it } from 'vitest';
import { CoreError } from './errors';
import { assertSafeUrl, normalizeBaseUrl } from './url';

function errorFrom(run: () => unknown): CoreError {
  try {
    run();
  } catch (error) {
    return error as CoreError;
  }
  throw new Error('Expected the call to throw');
}

describe('normalizeBaseUrl', () => {
  it.each([
    [' https://api.openai.com/v1/ ', 'https://api.openai.com/v1'],
    ['https://api.openai.com/v1/', 'https://api.openai.com/v1'],
    ['https://api.openai.com/', 'https://api.openai.com'],
    ['http://localhost:11434///', 'http://localhost:11434'],
    ['HTTPS://API.OPENAI.COM/v1', 'https://api.openai.com/v1'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected);
  });

  it.each([
    ['ftp://example.com', 'INVALID_URL'],
    ['file:///etc/passwd', 'INVALID_URL'],
    ['https://user:pass@example.com', 'INVALID_URL'],
    ['https://example.com/v1?key=secret', 'INVALID_URL'],
    ['https://example.com/v1#fragment', 'INVALID_URL'],
    ['', 'INVALID_URL'],
  ])('rejects %s', (input, code) => {
    expect(errorFrom(() => normalizeBaseUrl(input))).toMatchObject({ code });
  });

  it('does not echo credentials from an invalid base URL', () => {
    const error = errorFrom(() => normalizeBaseUrl('http://user:secret@'));
    expect(error.message).not.toContain('secret');
  });
});

describe('assertSafeUrl', () => {
  it.each([
    'https://api.openai.com/v1',
    'https://generativelanguage.googleapis.com/v1beta/models/x:streamGenerateContent?key=abc',
    'https://example.com:8443/path',
    'http://[2001:4860:4860::8888]/',
  ])('allows public address %s', (input) => {
    expect(assertSafeUrl(input).protocol).toMatch(/^https?:$/);
  });

  it.each([
    'http://127.0.0.1:11434',
    'http://127.1.2.3',
    'http://10.0.0.1',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://169.254.169.254/latest/meta-data',
    'http://0.0.0.0',
    'http://100.64.0.1',
    'http://224.0.0.1',
    'http://255.255.255.255',
    'http://[::1]',
    'http://[::]',
    'http://[fe80::1]',
    'http://[fd00::1]',
    'http://[::ffff:127.0.0.1]',
    'http://[64:ff9b::1]',
    'http://[2002::1]',
    'http://metadata.google.internal',
    'http://metadata.goog',
    'http://instance-data',
    'http://localhost.',
    'http://localtest.me',
    'http://127.0.0.1.nip.io',
    'http://2130706433',
    'http://0x7f000001',
    'file:///etc/passwd',
    'ftp://example.com',
    'https://user:pass@example.com',
  ])('blocks %s', (input) => {
    expect(errorFrom(() => assertSafeUrl(input))).toMatchObject({
      code: 'BLOCKED_URL',
    });
  });

  it('allows loopback only when the policy opts in', () => {
    for (const input of [
      'http://localhost:11434',
      'http://127.0.0.1:11434',
      'http://[::1]:11434',
    ]) {
      expect(assertSafeUrl(input, { allowLocalhost: true }).hostname).toBeTruthy();
    }
  });

  it('still blocks metadata and private ranges for the localhost policy', () => {
    for (const input of [
      'http://169.254.169.254',
      'http://10.0.0.1',
      'http://192.168.1.10',
      'http://metadata.google.internal',
    ]) {
      expect(
        errorFrom(() => assertSafeUrl(input, { allowLocalhost: true })),
      ).toMatchObject({ code: 'BLOCKED_URL' });
    }
  });
});
