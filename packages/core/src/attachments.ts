import { CoreError } from './errors';
import type { AttachmentLimits } from './types';

const MEBIBYTE = 1024 * 1024;

export const ATTACHMENT_LIMITS: AttachmentLimits = Object.freeze({
  maxFiles: 10,
  maxFileBytes: 10 * MEBIBYTE,
  maxTotalBytes: 20 * MEBIBYTE,
});

const SUPPORTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/json',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'application/x-pdf': 'application/pdf',
};

const EXTENSIONS: Record<string, string[]> = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg', 'jpe'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
  'application/json': ['json'],
  'text/plain': ['txt', 'text', 'log'],
  'text/markdown': ['md', 'markdown'],
  'text/csv': ['csv'],
};

const WINDOWS_RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[start + index] ?? 0);
  }
  return value;
}

function isText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function detectMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (bytes.length >= 6) {
    const gif = ascii(bytes, 0, 6);
    if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === 'RIFF' &&
    ascii(bytes, 8, 4) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  if (isText(bytes)) return 'text/plain';
  return null;
}

export function normalizeMimeType(type: string): string {
  const normalized = type.split(';')[0]?.trim().toLowerCase() ?? '';
  return MIME_ALIASES[normalized] ?? normalized;
}

function isSupportedMime(type: string): boolean {
  return SUPPORTED_MIME_TYPES.has(type);
}

function mimeCompatible(declared: string, detected: string): boolean {
  if (declared === detected) return true;
  if (declared.startsWith('text/') && detected === 'text/plain') return true;
  if (declared === 'application/json' && detected === 'text/plain') return true;
  return false;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

function extensionMatchesMime(name: string, type: string): boolean {
  const extension = extensionOf(name);
  if (!extension) {
    return type.startsWith('text/') || type === 'application/json';
  }
  return (EXTENSIONS[type] ?? []).includes(extension);
}

export function sanitizeFilename(input: string): string {
  const base = input.split(/[\\/]/).pop() ?? '';
  let name = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');

  if (!name || /^\.+$/.test(name)) return 'file';

  if (name.length > 200) {
    const extension = extensionOf(name);
    const suffix = extension ? `.${extension}`.slice(0, 20) : '';
    name = `${name.slice(0, 200 - suffix.length)}${suffix}`;
  }

  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  if (WINDOWS_RESERVED.has(stem.toUpperCase())) {
    name = `_${name}`;
  }

  return name;
}

export function stripBase64Prefix(value: string): string {
  const marker = ';base64,';
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : value;
}

export function formatAttachmentNote(attachment: {
  name: string;
  size: number;
}): string {
  return `\n[Attached File: ${attachment.name} (${Math.round(
    attachment.size / 1024,
  )} KB)]`;
}

export function assertAttachmentBudget(
  attachments: ReadonlyArray<{ size: number }>,
  limits: AttachmentLimits = ATTACHMENT_LIMITS,
): void {
  if (attachments.length > limits.maxFiles) {
    throw new CoreError(
      'TOO_MANY_FILES',
      `At most ${limits.maxFiles} files are allowed`,
    );
  }

  let total = 0;
  for (const attachment of attachments) {
    if (attachment.size > limits.maxFileBytes) {
      throw new CoreError(
        'FILE_TOO_LARGE',
        `Each file must be at most ${limits.maxFileBytes} bytes`,
      );
    }
    total += attachment.size;
  }

  if (total > limits.maxTotalBytes) {
    throw new CoreError(
      'TOTAL_TOO_LARGE',
      `Attachments must total at most ${limits.maxTotalBytes} bytes`,
    );
  }
}

export interface AttachmentValidationInput {
  name: string;
  type: string;
  bytes: Uint8Array;
  maxBytes: number;
}

export interface ValidatedAttachment {
  name: string;
  type: string;
  size: number;
}

export function validateAttachment(
  input: AttachmentValidationInput,
): ValidatedAttachment {
  const name = sanitizeFilename(input.name);
  const type = normalizeMimeType(input.type);

  if (!isSupportedMime(type)) {
    throw new CoreError('UNSUPPORTED_TYPE', `Unsupported file type: ${type}`);
  }
  if (input.bytes.byteLength === 0) {
    throw new CoreError('EMPTY_FILE', 'File is empty');
  }
  if (input.bytes.byteLength > input.maxBytes) {
    throw new CoreError(
      'FILE_TOO_LARGE',
      `File must be at most ${input.maxBytes} bytes`,
    );
  }

  const detected = detectMimeType(input.bytes);
  if (!detected || !mimeCompatible(type, detected)) {
    throw new CoreError(
      'MIME_MISMATCH',
      'File content does not match its declared type',
    );
  }
  if (!extensionMatchesMime(name, type)) {
    throw new CoreError(
      'EXTENSION_MISMATCH',
      'File extension does not match its declared type',
    );
  }

  return { name, type, size: input.bytes.byteLength };
}

function positiveNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveAttachmentLimits(
  env: Record<string, string | undefined>,
): AttachmentLimits {
  const fileMb = positiveNumber(env.ONE_ROUTER_MAX_FILE_MB);
  const totalMb = positiveNumber(env.ONE_ROUTER_MAX_TOTAL_MB);
  const files = positiveNumber(env.ONE_ROUTER_MAX_FILES);

  return {
    maxFiles: files ? Math.floor(files) : ATTACHMENT_LIMITS.maxFiles,
    maxFileBytes: fileMb
      ? Math.floor(fileMb * MEBIBYTE)
      : ATTACHMENT_LIMITS.maxFileBytes,
    maxTotalBytes: totalMb
      ? Math.floor(totalMb * MEBIBYTE)
      : ATTACHMENT_LIMITS.maxTotalBytes,
  };
}
