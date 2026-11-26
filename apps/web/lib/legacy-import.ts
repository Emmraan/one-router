const LEGACY_KEYS = [
  'onerouter_providers',
  'onerouter_chats',
  'onerouter_theme',
  'onerouter_master_key',
] as const;

const SUPPORTED_TYPES = new Set([
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

const MEBIBYTE = 1024 * 1024;

type LegacyKey = (typeof LEGACY_KEYS)[number];

export interface LegacySnapshot {
  values: Partial<Record<LegacyKey, string>>;
  present: LegacyKey[];
}

export interface LegacyArchivePreview {
  data: unknown;
  counts: { providers: number; chats: number; messages: number; attachments: number; settings: number };
  skipped: string[];
}

interface LegacyProvider {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
  models?: unknown;
  customHeaders?: unknown;
  isActive?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface LegacyAttachment {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  size?: unknown;
  base64?: unknown;
}

interface LegacyMessage {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  timestamp?: unknown;
  model?: unknown;
  isRegenerated?: unknown;
  attachments?: unknown;
}

interface LegacyChat {
  id?: unknown;
  title?: unknown;
  providerId?: unknown;
  model?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  isPinned?: unknown;
  manualTitle?: unknown;
  messages?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asTime(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function stripDataUrl(value: string): string {
  const marker = ';base64,';
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : value;
}

async function decryptLegacyKey(value: string, masterKey: Uint8Array<ArrayBuffer> | null): Promise<string> {
  if (!value.includes(':')) return value;
  if (!masterKey) throw new Error('The browser master key is missing.');
  const [ivPart, cipherPart] = value.split(':');
  if (!ivPart || !cipherPart) throw new Error('The encrypted key is malformed.');
  const key = await crypto.subtle.importKey('raw', masterKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64(ivPart) },
    key,
    decodeBase64(cipherPart),
  );
  return new TextDecoder().decode(plain);
}

function safeJson(value: string | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function uniqueId(base: string, used: Set<string>): string {
  let candidate = base || 'legacy-item';
  let suffix = 1;
  while (used.has(candidate)) {
    candidate = `${base || 'legacy-item'}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function readLegacySnapshot(): LegacySnapshot {
  if (typeof window === 'undefined') return { values: {}, present: [] };
  const values: Partial<Record<LegacyKey, string>> = {};
  const present: LegacyKey[] = [];
  for (const key of LEGACY_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value !== null) {
      values[key] = value;
      present.push(key);
    }
  }
  return { values, present };
}

export async function buildLegacyArchive(snapshot: LegacySnapshot): Promise<LegacyArchivePreview> {
  const skipped: string[] = [];
  const now = Date.now();
  const rawProviders = safeJson(snapshot.values.onerouter_providers);
  const rawChats = safeJson(snapshot.values.onerouter_chats);
  const providersInput = Array.isArray(rawProviders) ? (rawProviders as LegacyProvider[]) : [];
  const chatsInput = Array.isArray(rawChats) ? (rawChats as LegacyChat[]) : [];

  let masterKey: Uint8Array<ArrayBuffer> | null = null;
  if (snapshot.values.onerouter_master_key) {
    try {
      masterKey = decodeBase64(snapshot.values.onerouter_master_key);
    } catch {
      skipped.push('The saved master key could not be read; encrypted API keys were skipped.');
    }
  }

  const providerIds = new Set<string>();
  const providers: Record<string, unknown>[] = [];
  for (const provider of providersInput) {
    const id = asString(provider.id);
    const name = asString(provider.name).trim();
    const type = asString(provider.type);
    const baseUrl = asString(provider.baseUrl);
    if (!id || !name || !baseUrl || !['openai', 'anthropic', 'gemini', 'ollama'].includes(type)) {
      skipped.push(`Skipped provider ${name || id || 'with missing fields'}.`);
      continue;
    }
    if (providerIds.has(id)) {
      skipped.push(`Skipped duplicate provider ${name}.`);
      continue;
    }
    providerIds.add(id);
    let apiKey: string | undefined;
    const rawKey = asString(provider.apiKey);
    if (rawKey) {
      try {
        apiKey = await decryptLegacyKey(rawKey, masterKey);
      } catch {
        skipped.push(`Could not decrypt the API key for ${name}; it was not imported.`);
      }
    }
    const models = Array.isArray(provider.models)
      ? provider.models.filter((model): model is string => typeof model === 'string' && model.length > 0)
      : [];
    providers.push({
      id,
      name,
      type,
      baseUrl,
      models: models.length > 0 ? models : ['unknown'],
      isActive: asBoolean(provider.isActive),
      createdAt: asTime(provider.createdAt, now),
      updatedAt: asTime(provider.updatedAt, now),
      ...(apiKey ? { apiKey } : {}),
      ...(provider.customHeaders ? { customHeaders: provider.customHeaders } : {}),
    });
  }

  const chatIds = new Set<string>();
  const messageIds = new Set<string>();
  const attachmentIds = new Set<string>();
  const chats: Record<string, unknown>[] = [];
  const messages: Record<string, unknown>[] = [];
  const attachments: Record<string, unknown>[] = [];
  let skippedMessages = 0;
  let skippedAttachments = 0;

  for (const chat of chatsInput) {
    const rawId = asString(chat.id);
    if (!rawId) {
      skipped.push('Skipped a chat without an id.');
      continue;
    }
    const id = uniqueId(rawId, chatIds);
    const rawProviderId = asString(chat.providerId);
    const providerId = rawProviderId && providerIds.has(rawProviderId) ? rawProviderId : null;
    const title = asString(chat.title).trim().slice(0, 500) || 'New Chat';
    const chatMessages = Array.isArray(chat.messages) ? (chat.messages as LegacyMessage[]) : [];
    chats.push({
      id,
      providerId,
      title,
      model: asString(chat.model) || 'unknown',
      manualTitle: asBoolean(chat.manualTitle),
      isPinned: asBoolean(chat.isPinned),
      createdAt: asTime(chat.createdAt, now),
      updatedAt: asTime(chat.updatedAt, now),
      deletedAt: null,
    });

    let position = 0;
    for (const message of chatMessages) {
      const content = asString(message.content);
      const role = asString(message.role);
      if (!content || content.length > 100000 || !['user', 'assistant', 'system'].includes(role)) {
        skippedMessages += 1;
        continue;
      }
      const messageId = uniqueId(asString(message.id) || `${id}-message-${position}`, messageIds);
      const createdAt = asTime(message.timestamp, asTime(chat.createdAt, now));
      messages.push({
        id: messageId,
        chatId: id,
        role,
        content,
        model: asString(message.model) || null,
        position,
        isRegenerated: asBoolean(message.isRegenerated),
        createdAt,
        updatedAt: createdAt,
      });

      let messageBytes = 0;
      let messageFiles = 0;
      const files = Array.isArray(message.attachments) ? (message.attachments as LegacyAttachment[]) : [];
      for (const attachment of files) {
        if (messageFiles >= 10) break;
        const type = asString(attachment.type);
        const name = asString(attachment.name).slice(0, 255);
        const rawData = asString(attachment.base64);
        if (!SUPPORTED_TYPES.has(type) || !name || !rawData) {
          skippedAttachments += 1;
          continue;
        }
        const data = stripDataUrl(rawData);
        let size = 0;
        try {
          size = decodeBase64(data).byteLength;
        } catch {
          skippedAttachments += 1;
          continue;
        }
        if (size === 0 || size > 10 * MEBIBYTE || messageBytes + size > 20 * MEBIBYTE) {
          skippedAttachments += 1;
          continue;
        }
        messageBytes += size;
        messageFiles += 1;
        attachments.push({
          id: uniqueId(asString(attachment.id) || `${messageId}-file-${messageFiles}`, attachmentIds),
          messageId,
          name,
          mimeType: type,
          size,
          data,
          createdAt,
        });
      }
      position += 1;
    }
  }

  if (skippedMessages > 0) skipped.push(`${skippedMessages} messages were empty, invalid, or too large.`);
  if (skippedAttachments > 0) skipped.push(`${skippedAttachments} attachments were unsupported or too large.`);

  const theme = snapshot.values.onerouter_theme;
  const settings: Record<string, unknown> = {};
  if (theme === 'light' || theme === 'dark') settings.theme = theme;

  return {
    data: { providers, chats, messages, attachments, settings, profile: null },
    counts: {
      providers: providers.length,
      chats: chats.length,
      messages: messages.length,
      attachments: attachments.length,
      settings: Object.keys(settings).length,
    },
    skipped,
  };
}

export function clearLegacyKeys(snapshot: LegacySnapshot): string[] {
  if (typeof window === 'undefined') return [];
  const notCleared: string[] = [];
  for (const key of snapshot.present) {
    if (window.localStorage.getItem(key) === snapshot.values[key]) window.localStorage.removeItem(key);
    else notCleared.push(key);
  }
  return notCleared;
}
