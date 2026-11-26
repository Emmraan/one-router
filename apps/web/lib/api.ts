import type {
  AuthStatus,
  ChatDto,
  DiscoveryResult,
  ErrorBody,
  MessageDto,
  Page,
  ProviderDto,
} from './api-types';
import type { ProviderType } from './provider-types';

// An empty base means same-origin, which is how the CLI and Docker serve the
// static export. In `next dev` the UI runs on :3000 while Hono runs on :4000, so
// default to the API port unless a build sets the variable explicitly.
const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const API_BASE_URL = (
  configuredBase ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
).replace(/\/+$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: string[];
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, details?: string[], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ErrorBody).error === 'string' &&
    typeof (value as ErrorBody).code === 'string'
  );
}

export function toApiError(status: number, body: unknown): ApiError {
  if (isErrorBody(body)) {
    return new ApiError(status, body.code, body.error, body.details, body.requestId);
  }
  const fallback = status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED';
  return new ApiError(status, fallback, `Request failed with status ${status}`);
}

interface RequestOptions extends RequestInit {
  json?: unknown;
}

async function request(path: string, init: RequestOptions = {}): Promise<Response> {
  const { json, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  let body = rest.body;
  if (json !== undefined) {
    finalHeaders.set('content-type', 'application/json');
    body = JSON.stringify(json);
  }
  return fetch(apiUrl(path), {
    ...rest,
    headers: finalHeaders,
    body,
    credentials: 'include',
  });
}

export async function apiJson<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const response = await request(path, init);
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    throw toApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---- Auth ----

export function fetchAuthStatus(): Promise<AuthStatus> {
  return apiJson<AuthStatus>('/api/auth/status');
}

export function loginRequest(password: string): Promise<AuthStatus> {
  return apiJson<AuthStatus>('/api/auth/login', { method: 'POST', json: { password } });
}

export async function logoutRequest(): Promise<void> {
  await apiJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmation: string;
}

export function changePasswordRequest(input: ChangePasswordInput): Promise<{ ok: boolean; mustChangePassword: boolean }> {
  return apiJson('/api/auth/password', { method: 'POST', json: input });
}

// ---- Chats ----

export function listChats(trash = false, query = '', cursor?: string): Promise<Page<ChatDto>> {
  const params = new URLSearchParams({ limit: '100', trash: String(trash) });
  if (query.trim()) params.set('q', query.trim());
  if (cursor) params.set('cursor', cursor);
  return apiJson<Page<ChatDto>>(`/api/chats?${params}`);
}

export interface CreateChatInput {
  id?: string;
  title?: string;
  model: string;
  providerId?: string | null;
  isPinned?: boolean;
}

export function createChat(input: CreateChatInput): Promise<{ chat: ChatDto }> {
  return apiJson('/api/chats', { method: 'POST', json: input });
}

export interface UpdateChatInput {
  title?: string;
  source?: 'manual' | 'automatic';
  isPinned?: boolean;
  model?: string;
  providerId?: string | null;
}

export function updateChat(id: string, input: UpdateChatInput): Promise<{ chat: ChatDto }> {
  return apiJson(`/api/chats/${encodeURIComponent(id)}`, { method: 'PATCH', json: input });
}

export async function deleteChat(id: string, permanent = false): Promise<void> {
  const suffix = permanent ? '?permanent=true' : '';
  await apiJson<{ ok: boolean }>(`/api/chats/${encodeURIComponent(id)}${suffix}`, { method: 'DELETE' });
}

export async function restoreChat(id: string): Promise<void> {
  await apiJson<{ ok: boolean }>(`/api/chats/${encodeURIComponent(id)}/restore`, { method: 'POST' });
}

// ---- Messages ----

export function listMessages(chatId: string, cursor?: string): Promise<Page<MessageDto>> {
  const params = new URLSearchParams({ limit: '100' });
  if (cursor) params.set('cursor', cursor);
  return apiJson<Page<MessageDto>>(`/api/chats/${encodeURIComponent(chatId)}/messages?${params.toString()}`);
}

const MAX_MESSAGE_PAGES = 10;

// Walks the cursor pages until the chat is fully loaded. A single page caps at
// 100 rows, and 10 pages keeps a runaway chat bounded.
export async function listAllMessages(chatId: string): Promise<MessageDto[]> {
  const items: MessageDto[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_MESSAGE_PAGES; page += 1) {
    const result = await listMessages(chatId, cursor);
    items.push(...result.items);
    if (!result.nextCursor) return items;
    cursor = result.nextCursor;
  }
  throw new Error('This chat is too large to load in full.');
}

export interface CreateMessageInput {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  attachmentIds?: string[];
  createdAt?: number;
  isRegenerated?: boolean;
}

export function createMessage(chatId: string, input: CreateMessageInput): Promise<{ message: MessageDto }> {
  return apiJson(`/api/chats/${encodeURIComponent(chatId)}/messages`, { method: 'POST', json: input });
}

export function updateMessage(id: string, content: string): Promise<{ message: MessageDto }> {
  return apiJson(`/api/messages/${encodeURIComponent(id)}`, { method: 'PATCH', json: { content } });
}

export async function deleteMessage(id: string): Promise<void> {
  await apiJson<{ ok: boolean }>(`/api/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ---- Providers ----

export function listProviders(): Promise<{ providers: ProviderDto[] }> {
  return apiJson('/api/providers');
}

export interface ProviderInput {
  id?: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  customHeaders?: string | Record<string, string>;
  models?: string[];
  isActive?: boolean;
}

export function createProvider(input: ProviderInput): Promise<{ provider: ProviderDto }> {
  return apiJson('/api/providers', { method: 'POST', json: input });
}

export type ProviderPatch = Partial<Omit<ProviderInput, 'id'>>;

export function updateProvider(id: string, patch: ProviderPatch): Promise<{ provider: ProviderDto }> {
  return apiJson(`/api/providers/${encodeURIComponent(id)}`, { method: 'PATCH', json: patch });
}

export async function deleteProvider(id: string): Promise<void> {
  await apiJson<{ ok: boolean }>(`/api/providers/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ---- Settings ----

export function getSettings(): Promise<Record<string, unknown>> {
  return apiJson<{ settings: Record<string, unknown> }>('/api/settings').then((data) => data.settings);
}

export async function putSetting(key: string, value: unknown): Promise<void> {
  await apiJson<{ ok: boolean }>(`/api/settings/${encodeURIComponent(key)}`, { method: 'PUT', json: { value } });
}

// ---- Discovery / enhance ----

export interface DiscoveryInput {
  providerId?: string;
  providerType?: ProviderType;
  baseUrl?: string;
  apiKey?: string;
}

export function discoverModels(input: DiscoveryInput): Promise<DiscoveryResult> {
  return apiJson<DiscoveryResult>('/api/discovery', { method: 'POST', json: input });
}

export function enhancePrompt(prompt: string, providerId?: string, model?: string, signal?: AbortSignal): Promise<{ enhanced: string }> {
  return apiJson('/api/enhance', { method: 'POST', json: { prompt, providerId, model }, signal });
}

export function saveConversation(input: CreateChatInput & { messages: CreateMessageInput[] }): Promise<{ chat: ChatDto }> {
  return apiJson('/api/chats/save', { method: 'POST', json: input });
}

export function deleteFile(id: string, keepalive = false): Promise<{ ok: boolean }> {
  return apiJson(`/api/files/${encodeURIComponent(id)}`, { method: 'DELETE', keepalive });
}

export function generateTitle(message: string, providerId: string, model: string): Promise<{ title: string }> {
  return apiJson('/api/title', { method: 'POST', json: { message: message.slice(0, 100000), providerId, model } });
}

// ---- Data portability ----

export interface ArchiveCounts {
  providers: number;
  chats: number;
  messages: number;
  attachments: number;
  settings: number;
}

export interface ArchiveManifest {
  format: 'onerouter';
  version: 1;
  createdAt: number;
  checksum: string;
  counts: ArchiveCounts;
}

export async function exportData(input: { passphrase?: string; plaintext?: boolean }): Promise<{ blob: Blob; filename: string }> {
  const response = await request('/api/data/export', { method: 'POST', json: input });
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    throw toApiError(response.status, body);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? (input.plaintext || !input.passphrase ? 'one-router.json' : 'one-router.onerouter');
  return { blob: await response.blob(), filename };
}

export function previewImport(file: File, passphrase?: string): Promise<{ manifest: ArchiveManifest }> {
  const form = new FormData();
  form.set('file', file);
  if (passphrase) form.set('passphrase', passphrase);
  return apiJson('/api/data/preview', { method: 'POST', body: form });
}

export function importData(
  file: File,
  mode: 'merge' | 'replace',
  passphrase?: string,
): Promise<{ manifest: ArchiveManifest; imported: ArchiveCounts }> {
  const form = new FormData();
  form.set('file', file);
  form.set('mode', mode);
  if (passphrase) form.set('passphrase', passphrase);
  return apiJson('/api/data/import', { method: 'POST', body: form });
}

export function importLegacy(data: unknown): Promise<{ imported: ArchiveCounts }> {
  return apiJson('/api/data/legacy', { method: 'POST', json: { data } });
}
