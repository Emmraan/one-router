import { describe, expect, it } from 'vitest';
import { assessPassword, validateNewPassword } from './password';

describe('password policy', () => {
  it.each([
    ['short password', 'short', false],
    ['common default', 'passwordpassword', false],
    ['single repeated character', 'aaaaaaaaaaaaaaa', false],
    ['letters only', 'onlylettershere', false],
    ['mixed passphrase', 'correct horse battery staple', true],
    ['mixed with symbols', 'Long3r passphrase!', true],
  ])('%s', (_name, password, valid) => {
    expect(assessPassword(password).valid).toBe(valid);
  });

  it('reports every independent problem for feedback', () => {
    const result = assessPassword('aaaaaaaaaaaa');
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(1);
  });

  it('rejects the current password and a mismatched confirmation', () => {
    const issues = validateNewPassword('correct horse battery staple', 'correct horse battery staple', 'different');
    expect(issues).toContain('Password confirmation does not match');
    expect(issues).toContain('Choose a password different from the current one');
  });
});
