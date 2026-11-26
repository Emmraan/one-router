import { describe, expect, it } from 'vitest';
import {
  assertAttachmentBudget,
  detectMimeType,
  formatAttachmentNote,
  resolveAttachmentLimits,
  sanitizeFilename,
  stripBase64Prefix,
  validateAttachment,
} from './attachments';
import { CoreError } from './errors';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF = new TextEncoder().encode('GIF89a....');
const WEBP = new TextEncoder().encode('RIFF0000WEBP....');
const PDF = new TextEncoder().encode('%PDF-1.7\n');
const TEXT = new TextEncoder().encode('hello world');
const BINARY = Uint8Array.from([0, 1, 2, 3, 4]);

function errorFrom(run: () => unknown): CoreError {
  try {
    run();
  } catch (error) {
    return error as CoreError;
  }
  throw new Error('Expected the call to throw');
}

describe('detectMimeType', () => {
  it.each([
    ['png', PNG, 'image/png'],
    ['jpeg', JPEG, 'image/jpeg'],
    ['gif', GIF, 'image/gif'],
    ['webp', WEBP, 'image/webp'],
    ['pdf', PDF, 'application/pdf'],
    ['text', TEXT, 'text/plain'],
    ['empty', new Uint8Array(), null],
    ['binary', BINARY, null],
  ])('detects %s', (_label, bytes, expected) => {
    expect(detectMimeType(bytes)).toBe(expected);
  });
});

describe('validateAttachment', () => {
  it('accepts a matching image', () => {
    expect(
      validateAttachment({ name: 'photo.png', type: 'image/png', bytes: PNG, maxBytes: 1024 }),
    ).toEqual({ name: 'photo.png', type: 'image/png', size: PNG.byteLength });
  });

  it('accepts text, pdf, and json content', () => {
    for (const input of [
      { name: 'notes.txt', type: 'text/plain', bytes: TEXT },
      { name: 'doc.pdf', type: 'application/pdf', bytes: PDF },
      { name: 'data.json', type: 'application/json', bytes: TEXT },
    ]) {
      expect(validateAttachment({ ...input, maxBytes: 1024 }).name).toBe(input.name);
    }
  });

  it('rejects an empty file', () => {
    expect(
      errorFrom(() =>
        validateAttachment({ name: 'empty.txt', type: 'text/plain', bytes: new Uint8Array(), maxBytes: 10 }),
      ),
    ).toMatchObject({ code: 'EMPTY_FILE' });
  });

  it('rejects a file over the limit before inspecting it', () => {
    expect(
      errorFrom(() =>
        validateAttachment({ name: 'big.png', type: 'image/png', bytes: PNG, maxBytes: 4 }),
      ),
    ).toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('rejects an unsupported declared type', () => {
    expect(
      errorFrom(() =>
        validateAttachment({ name: 'x.svg', type: 'image/svg+xml', bytes: TEXT, maxBytes: 100 }),
      ),
    ).toMatchObject({ code: 'UNSUPPORTED_TYPE' });
  });

  it('rejects content that does not match the declared type', () => {
    expect(
      errorFrom(() =>
        validateAttachment({ name: 'fake.png', type: 'image/png', bytes: TEXT, maxBytes: 100 }),
      ),
    ).toMatchObject({ code: 'MIME_MISMATCH' });
  });

  it('rejects a declared type that does not match the magic bytes', () => {
    expect(
      errorFrom(() =>
        validateAttachment({ name: 'photo.jpg', type: 'image/jpeg', bytes: PNG, maxBytes: 100 }),
      ),
    ).toMatchObject({ code: 'MIME_MISMATCH' });
  });

  it('rejects a mismatched extension', () => {
    expect(
      errorFrom(() =>
        validateAttachment({ name: 'photo.jpg', type: 'image/png', bytes: PNG, maxBytes: 100 }),
      ),
    ).toMatchObject({ code: 'EXTENSION_MISMATCH' });
  });

  it('allows a text file without an extension', () => {
    expect(
      validateAttachment({ name: 'README', type: 'text/plain', bytes: TEXT, maxBytes: 100 }).name,
    ).toBe('README');
  });
});

describe('sanitizeFilename', () => {
  it.each([
    ['../../etc/passwd', 'passwd'],
    ['..\\..\\x', 'x'],
    ['C:\\temp\\file.txt', 'file.txt'],
    ['a<b>c?.txt', 'abc.txt'],
    ['  spaced name.txt  ', 'spaced name.txt'],
    ['..', 'file'],
    ['', 'file'],
    ['CON', '_CON'],
    ['file.txt.', 'file.txt'],
  ])('sanitizes %j', (input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected);
  });
});

describe('stripBase64Prefix', () => {
  it('strips a data URL prefix', () => {
    expect(stripBase64Prefix('data:image/png;base64,AAAA')).toBe('AAAA');
  });

  it('leaves raw base64 alone', () => {
    expect(stripBase64Prefix('AAAA')).toBe('AAAA');
  });
});

describe('formatAttachmentNote', () => {
  it('formats the legacy note', () => {
    expect(formatAttachmentNote({ name: 'doc.pdf', size: 2048 })).toBe(
      '\n[Attached File: doc.pdf (2 KB)]',
    );
  });
});

describe('assertAttachmentBudget', () => {
  const limits = { maxFiles: 2, maxFileBytes: 10, maxTotalBytes: 15 };

  it('accepts a budget within limits', () => {
    expect(() => assertAttachmentBudget([{ size: 5 }, { size: 5 }], limits)).not.toThrow();
  });

  it('rejects too many files', () => {
    expect(() =>
      assertAttachmentBudget([{ size: 1 }, { size: 1 }, { size: 1 }], limits),
    ).toThrowError(expect.objectContaining({ code: 'TOO_MANY_FILES' }));
  });

  it('rejects an oversized single file', () => {
    expect(() => assertAttachmentBudget([{ size: 11 }], limits)).toThrowError(
      expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
    );
  });

  it('rejects an oversized total', () => {
    expect(() =>
      assertAttachmentBudget([{ size: 8 }, { size: 8 }], limits),
    ).toThrowError(expect.objectContaining({ code: 'TOTAL_TOO_LARGE' }));
  });
});

describe('resolveAttachmentLimits', () => {
  it('uses defaults for missing or invalid values', () => {
    expect(resolveAttachmentLimits({})).toMatchObject({ maxFiles: 10 });
    expect(
      resolveAttachmentLimits({ ONE_ROUTER_MAX_FILE_MB: '0', ONE_ROUTER_MAX_FILES: 'nope' }),
    ).toMatchObject({ maxFiles: 10, maxFileBytes: 10 * 1024 * 1024 });
  });

  it('reads the documented environment names', () => {
    const limits = resolveAttachmentLimits({
      ONE_ROUTER_MAX_FILE_MB: '5',
      ONE_ROUTER_MAX_FILES: '3',
    });
    expect(limits).toMatchObject({ maxFiles: 3, maxFileBytes: 5 * 1024 * 1024 });
  });
});
