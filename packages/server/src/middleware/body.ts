import type { Context, MiddlewareHandler } from 'hono';
import type { ZodType } from 'zod';
import { HttpError } from '../errors';

function declaredLength(c: Context): number {
  const value = Number(c.req.header('content-length') ?? '');
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function bodyLimit(maxBytes: number): MiddlewareHandler {
  return async (c, next) => {
    if (declaredLength(c) > maxBytes) {
      throw new HttpError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE');
    }
    await next();
  };
}

async function readBytes(c: Context, maxBytes: number): Promise<Uint8Array> {
  if (declaredLength(c) > maxBytes) {
    throw new HttpError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE');
  }
  const body = c.req.raw.body;
  if (!body) return new Uint8Array();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('Request body is too large').catch(() => undefined);
        throw new HttpError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Unable to read request body', 'INVALID_REQUEST');
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // The reader is already released when the stream was cancelled.
    }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJson<T>(c: Context, schema: ZodType<T>, maxBytes = 1024 * 1024): Promise<T> {
  const bytes = await readBytes(c, maxBytes);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError(400, 'Request body is not valid UTF-8', 'INVALID_REQUEST');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON body', 'INVALID_JSON');
  }
  return schema.parse(raw);
}

export async function readForm(c: Context, maxBytes: number): Promise<FormData> {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new HttpError(400, 'Expected a multipart form body', 'INVALID_FORM');
  }
  const bytes = await readBytes(c, maxBytes);
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);

  let form: FormData;
  try {
    form = await new Response(copy, { headers: { 'content-type': contentType } }).formData();
  } catch {
    throw new HttpError(400, 'Invalid multipart body', 'INVALID_FORM');
  }
  let total = 0;
  for (const value of form.values()) {
    total += typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : value.size;
    if (total > maxBytes) throw new HttpError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE');
  }
  return form;
}
