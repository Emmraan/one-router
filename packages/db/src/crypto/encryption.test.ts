import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { decryptBytes, decryptText, encryptBytes, encryptText } from './encryption';
import { resolveMasterKey } from './key';
import { hashPassword, verifyPassword } from './password';

const key = Buffer.alloc(32, 7);
const directories: string[] = [];
afterAll(async () => {
  await Promise.all(directories.map((path) => rm(path, { recursive: true, force: true })));
});

describe('authenticated field encryption', () => {
  it.each(['', 'private title', '你好 🔑', 'line\nline\u0000'])('round-trips %j', (text) => {
    const encrypted = encryptText(text, key, 'owner:chat:title');
    expect(encrypted).toMatch(/^v1:/);
    expect(decryptText(encrypted, key, 'owner:chat:title')).toBe(text);
    expect(encryptText(text, key, 'owner:chat:title')).not.toBe(encrypted);
  });

  it('matches an independently assembled AES-256-GCM vector', async () => {
    const { createCipheriv } = await import('node:crypto');
    const iv = Buffer.alloc(12, 0);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from('vector'));
    const ciphertext = Buffer.concat([cipher.update('known plaintext'), cipher.final()]);
    const value = `v1:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`;
    expect(decryptText(value, key, 'vector')).toBe('known plaintext');
  });

  it('rejects wrong keys, changed tags, changed context, and malformed versions', () => {
    const encrypted = encryptText('secret', key, 'owner:a');
    expect(() => decryptText(encrypted, randomBytes(32), 'owner:a')).toThrow('decrypt');
    expect(() => decryptText(encrypted, key, 'owner:b')).toThrow('decrypt');
    const bytes = Buffer.from(encrypted.slice(3), 'base64');
    bytes[12] ^= 1;
    expect(() => decryptText(`v1:${bytes.toString('base64')}`, key, 'owner:a')).toThrow('decrypt');
    for (const value of ['plaintext', 'v2:abcd', 'v1:!', 'v1:AA==', `${encrypted}!`]) {
      expect(() => decryptText(value, key)).toThrow('decrypt');
    }
    expect(() => encryptText('secret', Buffer.alloc(31))).toThrow('key');
  });

  it('stores binary attachment ciphertext without losing bytes', () => {
    const bytes = Buffer.from([0, 1, 255, 128, 0]);
    const encrypted = encryptBytes(bytes, key, 'attachment');
    expect(encrypted.equals(bytes)).toBe(false);
    expect(decryptBytes(encrypted, key, 'attachment')).toEqual(bytes);
    expect(() => decryptBytes(encrypted.subarray(0, -1), key, 'attachment')).toThrow('decrypt');
  });
});

describe('master key storage', () => {
  it('creates an atomic persistent local key and owner-only POSIX permissions', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'one-router-key-'));
    directories.push(dataDir);
    const [first, second] = await Promise.all([
      resolveMasterKey({ dataDir }), resolveMasterKey({ dataDir }),
    ]);
    expect(first).toEqual(second);
    expect(first).toHaveLength(32);
    expect(await resolveMasterKey({ dataDir })).toEqual(first);
    expect(await readFile(join(dataDir, 'encryption.key'), 'utf8')).not.toContain('undefined');
    if (process.platform !== 'win32') {
      expect((await stat(join(dataDir, 'encryption.key'))).mode & 0o777).toBe(0o600);
    }
  });

  it('accepts explicit encoded keys and fails closed in production', async () => {
    expect(await resolveMasterKey({ value: key.toString('base64'), production: true })).toEqual(key);
    expect(await resolveMasterKey({ value: key.toString('hex') })).toEqual(key);
    const dataDir = await mkdtemp(join(tmpdir(), 'one-router-missing-key-'));
    directories.push(dataDir);
    await expect(resolveMasterKey({ dataDir, production: true })).rejects.toThrow('key');
    await expect(resolveMasterKey({ value: 'bad secret value', dataDir })).rejects.toThrow('key');
    await writeFile(join(dataDir, 'encryption.key'), 'invalid', { mode: 0o600 });
    await expect(resolveMasterKey({ dataDir })).rejects.toThrow('key');
  });
});

describe('scrypt passwords', () => {
  it('uses fresh salts, verifies correctly, and rejects malformed or excessive inputs', async () => {
    const password = 'a long test password';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('wrong password', first)).toBe(false);
    expect(await verifyPassword(password, 'invalid')).toBe(false);
    expect(await verifyPassword(password, first.replace('131072', '1073741824'))).toBe(false);
    await expect(hashPassword('short')).rejects.toThrow('Password');
    await expect(hashPassword('x'.repeat(1025))).rejects.toThrow('Password');
  }, 15000);
});
