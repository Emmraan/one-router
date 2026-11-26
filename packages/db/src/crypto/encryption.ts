import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function checkKey(key: Uint8Array): void {
  if (key.byteLength !== 32) throw new Error('Invalid encryption key');
}

export function encryptBytes(value: Uint8Array, key: Uint8Array, context = ''): Buffer {
  checkKey(key);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([Buffer.from('v1:'), iv, cipher.getAuthTag(), encrypted]);
}

export function decryptBytes(value: Uint8Array, key: Uint8Array, context = ''): Buffer {
  checkKey(key);
  try {
    const bytes = Buffer.from(value);
    if (bytes.length < 31 || bytes.subarray(0, 3).toString() !== 'v1:') throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(3, 15));
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(bytes.subarray(15, 31));
    return Buffer.concat([decipher.update(bytes.subarray(31)), decipher.final()]);
  } catch {
    throw new Error('Unable to decrypt value');
  }
}

export function encryptText(value: string, key: Uint8Array, context = ''): string {
  const bytes = encryptBytes(Buffer.from(value, 'utf8'), key, context);
  return `v1:${bytes.subarray(3).toString('base64')}`;
}

export function decryptText(value: string, key: Uint8Array, context = ''): string {
  if (!/^v1:(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Unable to decrypt value');
  }
  const bytes = Buffer.from(value.slice(3), 'base64');
  return decryptBytes(Buffer.concat([Buffer.from('v1:'), bytes]), key, context).toString('utf8');
}
