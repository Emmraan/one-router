import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const SCRYPT_PARAMS = Object.freeze({ N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 });

export function deriveKey(passphrase: string, salt: Uint8Array): Promise<Buffer> {
  if (Buffer.byteLength(passphrase, 'utf8') < 12 || Buffer.byteLength(passphrase, 'utf8') > 1024) {
    throw new Error('Password must contain 12 to 1024 UTF-8 bytes');
  }
  return new Promise((resolve, reject) => {
    scrypt(passphrase, salt, 32, SCRYPT_PARAMS, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  if ([...password].length < 12) throw new Error('Password must contain at least 12 characters');
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt);
  try {
    return `scrypt:v1:131072:8:1:${salt.toString('base64')}:${derived.toString('base64')}`;
  } finally {
    derived.fill(0);
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const match = /^scrypt:v1:131072:8:1:([A-Za-z0-9+/]{22}==):([A-Za-z0-9+/]{43}=)$/.exec(hash);
  if (!match) return false;
  try {
    const derived = await deriveKey(password, Buffer.from(match[1], 'base64'));
    try {
      return timingSafeEqual(derived, Buffer.from(match[2], 'base64'));
    } finally {
      derived.fill(0);
    }
  } catch {
    return false;
  }
}
