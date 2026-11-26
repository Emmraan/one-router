import type {
  ChatRequest,
  DiscoveryRequest,
  ProviderAdapter,
  ProviderHttpRequest,
} from '../types';
import { assertSafeUrl, normalizeBaseUrl } from '../url';
import {
  createOpenAiStreamParser,
  mapOpenAiMessages,
} from './openai';
import { isRecord, mergeHeaders } from './shared';

export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434';

function ollamaBaseUrl(baseUrl?: string): string {
  return normalizeBaseUrl(baseUrl?.trim() || OLLAMA_DEFAULT_BASE_URL);
}

export const ollamaAdapter: ProviderAdapter = {
  type: 'ollama',

  buildChatRequest(input: ChatRequest): ProviderHttpRequest {
    const url = `${ollamaBaseUrl(input.baseUrl)}/chat/completions`;
    assertSafeUrl(url, { allowLocalhost: true });

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
    const base = ollamaBaseUrl(input.baseUrl);
    const tags = `${base}/api/tags`;
    const models = `${base}/v1/models`;
    assertSafeUrl(tags, { allowLocalhost: true });
    assertSafeUrl(models, { allowLocalhost: true });

    return [
      { url: tags, method: 'GET', headers: {} },
      { url: models, method: 'GET', headers: {} },
    ];
  },

  parseDiscoveryResponse(body: unknown): string[] {
    if (isRecord(body) && Array.isArray(body.models)) {
      return body.models.flatMap((item) =>
        isRecord(item) && typeof item.name === 'string' ? [item.name] : [],
      );
    }

    if (isRecord(body) && Array.isArray(body.data)) {
      return body.data.flatMap((item) =>
        isRecord(item) && typeof item.id === 'string' ? [item.id] : [],
      );
    }

    return [];
  },

  createStreamParser: createOpenAiStreamParser,
};
