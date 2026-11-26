import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { HttpError, mapError, redactSecrets } from './errors';

describe('error mapping', () => {
  it.each([
    ['openai key', 'failed with sk-abcdef1234567890', 'sk-abcdef1234567890'],
    ['bearer token', 'Authorization: Bearer abc.def.ghi', 'abc.def.ghi'],
    ['api key assignment', 'api_key=super-secret-value', 'super-secret-value'],
    ['query key', 'https://example.com?key=topsecret&x=1', 'topsecret'],
    ['passphrase', 'passphrase: "open sesame now"', 'open sesame now'],
  ])('redacts the %s', (_name, input, secret) => {
    expect(redactSecrets(input)).not.toContain(secret);
  });

  it('keeps status, code, and details for HttpError', () => {
    const mapped = mapError(new HttpError(400, 'Password does not meet the policy', 'WEAK_PASSWORD', ['Too short']));
    expect(mapped).toEqual({
      status: 400,
      code: 'WEAK_PASSWORD',
      message: 'Password does not meet the policy',
      details: ['Too short'],
    });
  });

  it('does not expose internal error messages or stack data', () => {
    const mapped = mapError(new Error('connect failed at C:/data/one-router.db with sk-live-1234567890'));
    expect(mapped.status).toBe(500);
    expect(mapped.message).toBe('Server error');
    expect(JSON.stringify(mapped)).not.toContain('one-router.db');
  });

  it('summarizes validation issues without echoing values', () => {
    const result = mapError(new ZodError([
      { code: 'custom', message: 'Too small', path: ['password'], input: 'sk-secret-value' },
    ]));
    expect(result.status).toBe(400);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.details).toEqual(['password: Too small']);
    expect(JSON.stringify(result)).not.toContain('sk-secret-value');
  });

  it('truncates a long public message', () => {
    const mapped = mapError(new HttpError(400, 'x'.repeat(900), 'INVALID_REQUEST'));
    expect(mapped.message.length).toBe(500);
  });
});
