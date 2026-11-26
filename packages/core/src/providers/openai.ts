import { formatAttachmentNote, stripBase64Prefix } from '../attachments';
import { CoreError } from '../errors';
import type {
  ChatRequest,
  DiscoveryRequest,
  Message,
  ProviderAdapter,
  ProviderHttpRequest,
  StreamLineParser,
} from '../types';
import { assertSafeUrl, normalizeBaseUrl } from '../url';
import {
  dataPayload,
  isRecord,
  mergeHeaders,
  parseJsonObject,
  stringValue,
} from './shared';

export const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export function mapOpenAiMessages(
  messages: Message[],
): Array<{ role: string; content: unknown }> {
  return messages.map((message) => {
    if (message.attachments && message.attachments.length > 0) {
      const contentParts: unknown[] = [];

      if (message.content) {
        contentParts.push({ type: 'text', text: message.content });
      }

      for (const attachment of message.attachments) {
        if (attachment.type.startsWith('image/')) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: attachment.base64
                ? `data:${attachment.type};base64,${stripBase64Prefix(attachment.base64)}`
                : attachment.url,
            },
          });
        } else {
          contentParts.push({
            type: 'text',
            text: formatAttachmentNote(attachment),
          });
        }
      }

      return { role: message.role, content: contentParts };
    }

    return { role: message.role, content: message.content };
  });
}

export function createOpenAiStreamParser(): StreamLineParser {
  return (line) => {
    const payload = dataPayload(line);
    if (!payload || payload === '[DONE]') return null;

    const parsed = parseJsonObject(payload);
    if (!parsed) return null;

    if (parsed.error) {
      const detail = isRecord(parsed.error)
        ? stringValue(parsed.error.message)
        : stringValue(parsed.error);
      throw new CoreError(
        'UPSTREAM_ERROR',
        detail || 'Upstream stream error',
        502,
      );
    }

    const choices = parsed.choices;
    if (!Array.isArray(choices) || choices.length === 0) return null;

    const choice = choices[0];
    if (!isRecord(choice) || !isRecord(choice.delta)) return null;

    const text = choice.delta.content;
    return typeof text === 'string' && text ? text : null;
  };
}

function discoveryHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

export const openaiAdapter: ProviderAdapter = {
  type: 'openai',

  buildChatRequest(input: ChatRequest): ProviderHttpRequest {
    const base = normalizeBaseUrl(
      input.baseUrl?.trim() || OPENAI_DEFAULT_BASE_URL,
    );
    const url = `${base}/chat/completions`;
    assertSafeUrl(url);

    const headers = mergeHeaders(
      { 'Content-Type': 'application/json' },
      input.customHeaders,
    );
    if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`;

    return {
      url,
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: input.model,
        messages: mapOpenAiMessages(input.messages),
        stream: true,
      }),
    };
  },

  buildDiscoveryRequests(input: DiscoveryRequest): ProviderHttpRequest[] {
    const base = normalizeBaseUrl(
      input.baseUrl?.trim() || OPENAI_DEFAULT_BASE_URL,
    );
    const url = `${base}/models`;
    assertSafeUrl(url);

    return [
      {
        url,
        method: 'GET',
        headers: discoveryHeaders(input.apiKey),
      },
    ];
  },

  parseDiscoveryResponse(body: unknown): string[] {
    if (!isRecord(body) || !Array.isArray(body.data)) return [];

    const models: string[] = [];
    for (const item of body.data) {
      if (isRecord(item) && typeof item.id === 'string') {
        models.push(item.id);
      }
    }
    return models;
  },

  createStreamParser: createOpenAiStreamParser,
};
