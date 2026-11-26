const COMMON_PASSWORDS = new Set([
  'password', 'password1234', 'passwordpassword', '123456789012', 'changeme1234',
  'letmein12345', 'qwertyuiop12', 'onerouter1234', 'one-router1234', 'administrator',
]);

export interface PasswordAssessment {
  valid: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  issues: string[];
}

export function assessPassword(password: string): PasswordAssessment {
  const issues: string[] = [];
  const characters = [...password];
  const normalized = password.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (characters.length < 12) issues.push('Use at least 12 characters');
  if (Buffer.byteLength(password, 'utf8') > 1024) issues.push('Use at most 1024 UTF-8 bytes');
  if (COMMON_PASSWORDS.has(normalized)) issues.push('Choose a password that is not a common default');
  if (new Set(characters).size < 4) issues.push('Use more distinct characters');

  const categories = [
    /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  if (categories < 2 && characters.length < 20) issues.push('Mix letters with digits or symbols');

  const score = Math.max(0, Math.min(4, categories + (characters.length >= 16 ? 1 : 0))) as 0 | 1 | 2 | 3 | 4;
  return { valid: issues.length === 0, score, issues };
}

export function validateNewPassword(password: string, currentPassword: string, confirmation: string): string[] {
  const issues = assessPassword(password).issues;
  if (confirmation !== password) issues.push('Password confirmation does not match');
  if (password === currentPassword) issues.push('Choose a password different from the current one');
  return issues;
}
