import { CoreError, toErrorMessage } from '../errors';
import type { ChatDeps, ChatRequest, DiscoveryRequest, DiscoveryResult, FetchLike, ProviderAdapter, ProviderType } from '../types';
import { normalizeStream } from './normalize-stream';
import { anthropicAdapter } from './anthropic';
import { geminiAdapter } from './gemini';
import { ollamaAdapter } from './ollama';
import { openaiAdapter } from './openai';

export { parseCustomHeaders } from './shared';

const ADAPTERS: Record<ProviderType, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  ollama: ollamaAdapter,
};

export function getProviderAdapter(type: string): ProviderAdapter {
  if (!Object.hasOwn(ADAPTERS, type)) {
    throw new CoreError('UNSUPPORTED_PROVIDER', `Unsupported provider: ${type}`);
  }
  return ADAPTERS[type as ProviderType];
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

async function readErrorText(response: Response): Promise<string> {
  const limit = 8192;
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';

  try {
    while (text.length < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    // The status and whatever text arrived are still useful.
  } finally {
    try {
      await reader.cancel();
    } catch {
      // The reader may already be closed.
    }
  }

  return text.slice(0, limit).trim();
}

async function readDiscoveryBody(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('No discovery response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2 * 1024 * 1024) throw new Error('Discovery response exceeded the 2 MiB limit');
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally {
    try { await reader.cancel(); }
    finally { reader.releaseLock(); }
  }
}

export async function chatCompletion(
  input: ChatRequest,
  deps: ChatDeps = {},
): Promise<ReadableStream<Uint8Array>> {
  const adapter = getProviderAdapter(input.providerType);
  const request = adapter.buildChatRequest(input);
  const fetchImpl: FetchLike = deps.fetch ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: deps.signal,
      redirect: 'manual',
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new CoreError('ABORTED', 'Request aborted', 499);
    }
    throw new CoreError('UPSTREAM_ERROR', toErrorMessage(error), 502);
  }

  if (!response.ok) {
    const detail =
      (await readErrorText(response)) ||
      response.statusText ||
      String(response.status);
    throw new CoreError(
      'UPSTREAM_STATUS',
      `Upstream error: ${detail}`,
      response.status >= 400 ? response.status : 502,
    );
  }

  if (!response.body) {
    throw new CoreError(
      'EMPTY_RESPONSE',
      'No response body from upstream API',
      502,
    );
  }

  return normalizeStream(response.body, adapter.createStreamParser());
}

export async function discoverModels(
  input: DiscoveryRequest,
  deps: ChatDeps = {},
): Promise<DiscoveryResult> {
  const adapter = getProviderAdapter(input.providerType);
  const fetchImpl: FetchLike = deps.fetch ?? fetch;

  for (const request of adapter.buildDiscoveryRequests(input)) {
    let response: Response;
    try {
      response = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        signal: deps.signal,
        redirect: 'manual',
      });
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }

    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
        // The error body is not needed.
      }
      continue;
    }

    let body: unknown;
    try {
      body = await readDiscoveryBody(response);
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }

    const models = adapter
      .parseDiscoveryResponse(body)
      .filter((name) => name.length > 0);
    if (models.length > 1000) return { success: false, error: 'Discovery response exceeded the 1,000 model limit' };
    if (models.length > 0) {
      return { success: true, models: [...models].sort() };
    }
    break;
  }

  return {
    success: false,
    error: 'No models found dynamically. Proceeded with preset defaults.',
  };
}
