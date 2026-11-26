import { describe, expect, it } from 'vitest';
import { CoreError, isCoreError } from './errors';

describe('CoreError', () => {
  it('keeps the code and status', () => {
    const error = new CoreError('BLOCKED_URL', 'blocked', 400);
    expect(error).toMatchObject({
      name: 'CoreError',
      code: 'BLOCKED_URL',
      status: 400,
      message: 'blocked',
    });
  });

  it('defaults to a 400 status', () => {
    expect(new CoreError('INVALID_REQUEST', 'bad input').status).toBe(400);
  });

  it('recognizes its own instances', () => {
    expect(isCoreError(new CoreError('UPSTREAM_ERROR', 'x'))).toBe(true);
    expect(isCoreError(new Error('x'))).toBe(false);
    expect(isCoreError(null)).toBe(false);
  });
});
