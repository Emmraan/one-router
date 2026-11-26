import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './test-helpers';

let context: TestContext;

beforeEach(async () => {
  context = await createTestContext({ passwordChanged: true });
  await context.login();
});

afterEach(async () => {
  await context.close();
});

function endlessStream(size = 64 * 1024): ReadableStream<Uint8Array> {
  const chunk = new Uint8Array(size).fill(0x61);
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(chunk.slice());
    },
  });
}

type StreamingInit = RequestInit & { duplex: 'half' };

describe('bounded body reads', () => {
  it('stops an endless JSON body even when content-length lies', async () => {
    const response = await context.request('/api/chats', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '10' },
      body: endlessStream(),
      duplex: 'half',
    } as StreamingInit);
    expect(response.status).toBe(413);
    expect(((await response.json()) as { code: string }).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('stops an endless multipart body even when content-length lies', async () => {
    const response = await context.request('/api/files', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=----one-router-test', 'content-length': '10' },
      body: endlessStream(),
      duplex: 'half',
    } as StreamingInit);
    expect(response.status).toBe(413);
    expect(((await response.json()) as { code: string }).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('still accepts a normal chunked JSON request', async () => {
    const payload = JSON.stringify({ model: 'gpt-4o', title: 'Chunked chat' });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(payload));
        controller.close();
      },
    });
    const response = await context.request('/api/chats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      duplex: 'half',
    } as StreamingInit);
    expect(response.status).toBe(201);
  });

  it('rejects invalid UTF-8 in a JSON body', async () => {
    const response = await context.request('/api/chats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: new Uint8Array([0xff, 0xfe, 0x7b, 0x7d]),
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('INVALID_REQUEST');
  });

  it('requires a multipart content type for form routes', async () => {
    const response = await context.request('/api/files', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: 'not a form',
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('INVALID_FORM');
  });
});
