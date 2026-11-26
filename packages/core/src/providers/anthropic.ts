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

export const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
export const ANTHROPIC_DISCOVERY_BASE_URL = 'https://api.anthropic.com';

function mapAnthropicMessages(
  messages: Message[],
): Array<{ role: string; content: unknown }> {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => {
      if (message.attachments && message.attachments.length > 0) {
        const contentParts: unknown[] = [];

        if (message.content) {
          contentParts.push({ type: 'text', text: message.content });
        }

        for (const attachment of message.attachments) {
          if (attachment.type.startsWith('image/')) {
            contentParts.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: attachment.type,
                data: stripBase64Prefix(attachment.base64 ?? ''),
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

      return {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      };
    });
}

export function createAnthropicStreamParser(): StreamLineParser {
  return (line) => {
    const payload = dataPayload(line);
    if (!payload) return null;

    const parsed = parseJsonObject(payload);
    if (!parsed) return null;

    if (parsed.type === 'error') {
      const detail = isRecord(parsed.error)
        ? stringValue(parsed.error.message)
        : null;
      throw new CoreError(
        'UPSTREAM_ERROR',
        detail || 'Anthropic stream error',
        502,
      );
    }

    if (parsed.type !== 'content_block_delta') return null;
    if (!isRecord(parsed.delta)) return null;

    const text = parsed.delta.text;
    return typeof text === 'string' && text ? text : null;
  };
}

export const anthropicAdapter: ProviderAdapter = {
  type: 'anthropic',

  buildChatRequest(input: ChatRequest): ProviderHttpRequest {
    const base = normalizeBaseUrl(
      input.baseUrl?.trim() || ANTHROPIC_DEFAULT_BASE_URL,
    );
    const url = `${base}/messages`;
    assertSafeUrl(url);

    const headers = mergeHeaders(
      { 'Content-Type': 'application/json' },
      input.customHeaders,
    );
    if (input.apiKey) headers['x-api-key'] = input.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';

    const systemPrompt = input.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');

    const body: Record<string, unknown> = {
      model: input.model,
      messages: mapAnthropicMessages(input.messages),
      max_tokens: 4096,
      stream: true,
    };
    if (systemPrompt) body.system = systemPrompt;

    return {
      url,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    };
  },

  buildDiscoveryRequests(input: DiscoveryRequest): ProviderHttpRequest[] {
    const base = normalizeBaseUrl(
      input.baseUrl?.trim() || ANTHROPIC_DISCOVERY_BASE_URL,
    );
    const url = base.endsWith('/v1')
      ? `${base}/models`
      : `${base}/v1/models`;
    assertSafeUrl(url);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (input.apiKey) headers['x-api-key'] = input.apiKey;

    return [{ url, method: 'GET', headers }];
  },

  parseDiscoveryResponse(body: unknown): string[] {
    if (isRecord(body) && Array.isArray(body.data)) {
      return body.data.flatMap((item) =>
        isRecord(item) && typeof item.id === 'string' ? [item.id] : [],
      );
    }

    if (Array.isArray(body)) {
      return body.flatMap((item) => {
        if (typeof item === 'string') return [item];
        return isRecord(item) && typeof item.id === 'string' ? [item.id] : [];
      });
    }

    return [];
  },

  createStreamParser: createAnthropicStreamParser,
};
