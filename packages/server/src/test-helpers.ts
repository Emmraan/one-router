import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { hashPassword, migrate, openDatabase, type Database } from '@one-router/db';
import type { FetchLike } from '@one-router/core';
import { createApp } from './app';
import { loadEnv, type ServerEnv } from './env';
import { SESSION_COOKIE } from './auth/cookies';
import type { LogEntry } from './types';

export const TEST_PASSWORD = 'correct horse battery staple';
export const TEST_ORIGIN = 'http://localhost:4000';

export function testEnv(directory: string, overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    ...loadEnv({
      NODE_ENV: 'test',
      ONE_ROUTER_DATA_DIR: directory,
      ONE_ROUTER_ALLOWED_ORIGINS: TEST_ORIGIN,
    }),
    ...overrides,
  };
}

export interface TestContext {
  db: Database;
  env: ServerEnv;
  logs: LogEntry[];
  ownerId: string;
  getCookie(): string;
  fetchCalls: Array<{ url: string; init?: RequestInit }>;
  request(path: string, init?: RequestInit, options?: { auth?: boolean; origin?: string | null }): Promise<Response>;
  login(password?: string): Promise<Response>;
  setCookieFrom(response: Response): void;
  close(): Promise<void>;
}

export async function removeDirectory(directory: string): Promise<void> {
  if (process.platform === 'win32') {
    await setImmediate();
    global.gc?.();
    await setImmediate();
    global.gc?.();
    await setImmediate();
  }
  await rm(directory, { recursive: true, force: true });
}

let cachedPasswordHash: Promise<string> | undefined;

function testPasswordHash(): Promise<string> {
  cachedPasswordHash ??= hashPassword(TEST_PASSWORD);
  return cachedPasswordHash;
}

export async function createTestContext(options: {
  env?: Partial<ServerEnv>;
  fetch?: FetchLike;
  now?: () => number;
  seed?: boolean;
  passwordChanged?: boolean;
} = {}): Promise<TestContext> {
  const directory = await mkdtemp(join(tmpdir(), 'one-router-server-'));
  const env = testEnv(directory, options.env);
  env.databaseUrl = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  env.dataDir = directory;
  const db = await openDatabase({ url: env.databaseUrl, key: randomBytes(32) });
  await migrate(db);
  let ownerId = '';
  if (options.seed !== false) {
    ownerId = randomUUID();
    const now = Date.now();
    await db.client.execute({
      sql: 'INSERT INTO users (id, role, password_hash, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [ownerId, 'owner', await testPasswordHash(), options.passwordChanged ? 0 : 1, now, now],
    });
  }

  const logs: LogEntry[] = [];
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const recordingFetch: FetchLike | undefined = options.fetch
    ? async (input, init) => {
        fetchCalls.push({ url: input.toString(), init });
        return options.fetch!(input, init);
      }
    : undefined;
  const app = createApp({
    db,
    env,
    fetch: recordingFetch,
    now: options.now,
    logger: (entry) => logs.push(entry),
  });

  let cookie = '';
  const request = async (path: string, init: RequestInit = {}, requestOptions: { auth?: boolean; origin?: string | null } = {}) => {
    const headers = new Headers(init.headers);
    if (requestOptions.origin === null) headers.delete('origin');
    else if (requestOptions.origin !== undefined) headers.set('origin', requestOptions.origin);
    else if (!headers.has('origin')) headers.set('origin', TEST_ORIGIN);
    if (requestOptions.auth !== false && cookie) headers.set('cookie', `${SESSION_COOKIE}=${cookie}`);
    const response = await app.request(path, { ...init, headers });
    return response;
  };

  const setCookieFrom = (response: Response) => {
    const header = response.headers.get('set-cookie') ?? '';
    const match = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(header);
    if (match) cookie = match[1];
  };

  const login = async (password = TEST_PASSWORD) => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }, { auth: false });
    setCookieFrom(response);
    return response;
  };

  return {
    db,
    env,
    logs,
    ownerId,
    getCookie: () => cookie,
    fetchCalls,
    request,
    login,
    setCookieFrom,
    async close() {
      db.close();
      await removeDirectory(directory);
    },
  };
}

export function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), { status, headers: { 'content-type': 'text/event-stream' } });
}

export function openAiSse(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}
