import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './api';

describe('toApiError', () => {
  it('keeps a complete error body', () => {
    const error = toApiError(400, {
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
      requestId: 'req-1',
      details: ['password: too short'],
    });
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid request');
    expect(error.requestId).toBe('req-1');
    expect(error.details).toEqual(['password: too short']);
  });

  it('accepts a body without optional fields', () => {
    const error = toApiError(404, { error: 'Not found', code: 'NOT_FOUND' });
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Not found');
    expect(error.requestId).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  const fallbackCases: Array<{ name: string; status: number; body: unknown; code: string }> = [
    { name: 'null body', status: 500, body: null, code: 'REQUEST_FAILED' },
    { name: 'text body', status: 500, body: 'boom', code: 'REQUEST_FAILED' },
    { name: 'array body', status: 500, body: [], code: 'REQUEST_FAILED' },
    { name: 'missing code', status: 500, body: { error: 'boom' }, code: 'REQUEST_FAILED' },
    { name: 'numeric code', status: 500, body: { error: 'boom', code: 500 }, code: 'REQUEST_FAILED' },
    { name: 'numeric message', status: 500, body: { error: 1, code: 'X' }, code: 'REQUEST_FAILED' },
    { name: 'unauthorized', status: 401, body: null, code: 'UNAUTHENTICATED' },
    { name: 'forbidden without body', status: 403, body: undefined, code: 'REQUEST_FAILED' },
  ];

  for (const testCase of fallbackCases) {
    it(`falls back for ${testCase.name}`, () => {
      const error = toApiError(testCase.status, testCase.body);
      expect(error.status).toBe(testCase.status);
      expect(error.code).toBe(testCase.code);
      expect(error.message).toBe(`Request failed with status ${testCase.status}`);
    });
  }
});
