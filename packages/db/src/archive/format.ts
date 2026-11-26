import { randomBytes } from 'node:crypto';
import { decryptBytes, encryptBytes } from '../crypto/encryption';
import { deriveKey } from '../crypto/password';
import { archiveCounts, checksum, manifestSchema, MAX_ARCHIVE_BYTES, validateArchiveData, type ArchiveData } from './schema';

const magic = Buffer.from('ONEROUTER\x01', 'binary');
const headerLength = magic.length + 16;

export function archiveDocument(input: unknown, now = Date.now()) {
  const data = validateArchiveData(input);
  const manifest = manifestSchema.parse({ format: 'onerouter', version: 1, createdAt: now, checksum: checksum(data), counts: archiveCounts(data) });
  return { manifest, data };
}

export function parseArchiveDocument(input: unknown) {
  if (!input || typeof input !== 'object' || Object.keys(input).some((key) => !['manifest', 'data'].includes(key))) throw new Error('Invalid archive document');
  const raw = input as { manifest: unknown; data: unknown };
  const manifest = manifestSchema.parse(raw.manifest);
  const data = validateArchiveData(raw.data);
  if (manifest.checksum !== checksum(data) || JSON.stringify(manifest.counts) !== JSON.stringify(archiveCounts(data))) throw new Error('Invalid archive checksum or counts');
  return { manifest, data };
}

export async function encodeArchive(data: ArchiveData, passphrase: string, now = Date.now()): Promise<Buffer> {
  let key: Buffer | undefined;
  try {
    const document = archiveDocument(data, now);
    const plaintext = Buffer.from(JSON.stringify(document));
    if (plaintext.byteLength > MAX_ARCHIVE_BYTES - headerLength - 31) throw new Error();
    const header = Buffer.concat([magic, randomBytes(16)]);
    key = await deriveKey(passphrase, header.subarray(magic.length));
    return Buffer.concat([header, encryptBytes(plaintext, key, header.toString('base64'))]);
  } catch {
    throw new Error('Unable to encode archive; check data, limits and passphrase');
  } finally { key?.fill(0); }
}

export function isEncryptedArchive(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).subarray(0, magic.length).equals(magic);
}

export async function decodeArchive(bytes: Uint8Array, passphrase: string) {
  let key: Buffer | undefined;
  try {
    if (bytes.byteLength < headerLength + 31 || bytes.byteLength > MAX_ARCHIVE_BYTES || !isEncryptedArchive(bytes)) throw new Error();
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const header = buffer.subarray(0, headerLength);
    key = await deriveKey(passphrase, header.subarray(magic.length));
    const plaintext = decryptBytes(buffer.subarray(headerLength), key, header.toString('base64'));
    return parseArchiveDocument(JSON.parse(plaintext.toString('utf8')));
  } catch {
    throw new Error('Unable to read archive; invalid passphrase, version, integrity or data');
  } finally { key?.fill(0); }
}

export function decodePlaintext(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('Invalid plaintext archive size');
  try {
    const document = JSON.parse(Buffer.from(bytes).toString('utf8'));
    if (Array.isArray(document?.data?.providers) && document.data.providers.some((provider: Record<string, unknown>) =>
      provider && (Object.hasOwn(provider, 'apiKey') || Object.hasOwn(provider, 'customHeaders')))) {
      throw new Error('Provider credentials are not permitted in plaintext');
    }
    return parseArchiveDocument(document);
  } catch {
    throw new Error('Invalid plaintext archive; credentials, version, integrity or data rejected');
  }
}
