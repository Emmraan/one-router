import { formatAttachmentNote, stripBase64Prefix } from '../attachments';
import { CoreError } from '../errors';
import type {
  ChatRequest,
  DiscoveryRequest,
  FetchLike,
  Message,
  ProviderAdapter,
  ProviderHttpRequest,
  StreamLineParser,
} from '../types';
import { assertSafeUrl } from '../url';
import {
  isRecord,
  mergeHeaders,
  parseJsonObject,
  stringValue,
} from './shared';

export const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
export const GEMINI_TITLE_MODEL = 'gemini-2.0-flash';

function mapGeminiContents(messages: Message[]): unknown[] {
  return messages.map((message) => {
    const parts: unknown[] = [];

    if (message.content) {
      parts.push({ text: message.content });
    }

    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        if (attachment.type.startsWith('image/')) {
          parts.push({
            inlineData: {
              mimeType: attachment.type,
              data: stripBase64Prefix(attachment.base64 ?? ''),
            },
          });
        } else {
          parts.push({ text: formatAttachmentNote(attachment) });
        }
      }
    }

    return {
      role: message.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });
}

function geminiText(parsed: Record<string, unknown>): string | null {
  const candidates = parsed.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const candidate = candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content)) return null;

  const parts = candidate.content.parts;
  if (!Array.isArray(parts)) return null;

  const text = parts
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('');
  return text || null;
}

export function createGeminiStreamParser(): StreamLineParser {
  return (line) => {
    let normalized = line.trim();
    if (normalized.startsWith(',')) normalized = normalized.slice(1).trim();
    if (normalized.startsWith('[')) normalized = normalized.slice(1).trim();
    if (normalized.endsWith(']')) {
      normalized = normalized.slice(0, -1).trim();
    }
    if (normalized.endsWith(',')) {
      normalized = normalized.slice(0, -1).trim();
    }
    if (!normalized) return null;

    const parsed = parseJsonObject(normalized);
    if (!parsed) return null;

    if (parsed.error) {
      const detail = isRecord(parsed.error)
        ? stringValue(parsed.error.message)
        : stringValue(parsed.error);
      throw new CoreError(
        'UPSTREAM_ERROR',
        detail || 'Gemini stream error',
        502,
      );
    }

    return geminiText(parsed);
  };
}

export interface GenerateGeminiTextOptions {
  apiKey: string;
  prompt: string;
  model?: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
}

export async function generateGeminiText(
  options: GenerateGeminiTextOptions,
): Promise<string> {
  const model = options.model ?? GEMINI_TITLE_MODEL;
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(options.apiKey)}`;
  assertSafeUrl(url);

  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: options.prompt }] }],
    }),
    signal: options.signal,
    redirect: 'manual',
  });

  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {
      // The error body is not needed.
    }
    throw new CoreError(
      'UPSTREAM_STATUS',
      `Gemini request failed (${response.status})`,
      response.status >= 400 ? response.status : 502,
    );
  }

  const data = (await response.json()) as unknown;
  const text = isRecord(data) ? geminiText(data) : null;
  if (!text) {
    throw new CoreError('EMPTY_RESPONSE', 'Gemini returned no text', 502);
  }
  return text.trim();
}

export const geminiAdapter: ProviderAdapter = {
  type: 'gemini',

  buildChatRequest(input: ChatRequest): ProviderHttpRequest {
    const model = input.model?.trim() || GEMINI_DEFAULT_MODEL;
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(
      model,
    )}:streamGenerateContent?key=${encodeURIComponent(input.apiKey ?? '')}`;
    assertSafeUrl(url);

    const systemMessage = input.messages.find(
      (message) => message.role === 'system',
    );
    const config: Record<string, unknown> = {};
    if (systemMessage) {
      config.systemInstruction = { parts: [{ text: systemMessage.content }] };
    }

    return {
      url,
      method: 'POST',
      headers: mergeHeaders(
        { 'Content-Type': 'application/json' },
        input.customHeaders,
      ),
      body: JSON.stringify({
        contents: mapGeminiContents(input.messages),
        config,
      }),
    };
  },

  buildDiscoveryRequests(input: DiscoveryRequest): ProviderHttpRequest[] {
    const url = `${GEMINI_API_BASE}/models?key=${encodeURIComponent(
      input.apiKey ?? '',
    )}`;
    assertSafeUrl(url);
    return [
      {
        url,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    ];
  },

  parseDiscoveryResponse(body: unknown): string[] {
    if (!isRecord(body) || !Array.isArray(body.models)) return [];

    const models: string[] = [];
    for (const item of body.models) {
      if (!isRecord(item) || typeof item.name !== 'string') continue;
      const name = item.name.replace(/^models\//, '');
      if (
        name.startsWith('embedding-') ||
        name.includes('bidi') ||
        name.includes('classifier')
      ) {
        continue;
      }
      models.push(name);
    }
    return models;
  },

  createStreamParser: createGeminiStreamParser,
};
