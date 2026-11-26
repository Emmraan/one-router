import { CoreError, toErrorMessage } from '../errors';
import type { ChatDeps, ChatRequest, DiscoveryRequest, DiscoveryResult, FetchLike, ProviderAdapter, ProviderType, StreamLineParser } from '../types';
import { encodeSse } from '../sse';
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

function normalizeStream(
  body: ReadableStream<Uint8Array>,
  parseLine: StreamLineParser,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const maxLineBytes = 1024 * 1024;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      reader = body.getReader();
      let buffer = '';

      const emit = (line: string) => {
        if (line.length > maxLineBytes) {
          throw new CoreError(
            'UPSTREAM_ERROR',
            'Upstream stream line exceeded the 1 MiB limit',
            502,
          );
        }
        const text = parseLine(line.endsWith('\r') ? line.slice(0, -1) : line);
        if (text) controller.enqueue(encoder.encode(encodeSse({ text })));
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let lineEnd: number;
          while ((lineEnd = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, lineEnd);
            buffer = buffer.slice(lineEnd + 1);
            if (line.trim()) emit(line);
          }

          if (buffer.length > maxLineBytes) {
            throw new CoreError(
              'UPSTREAM_ERROR',
              'Upstream stream line exceeded the 1 MiB limit',
              502,
            );
          }
        }

        buffer += decoder.decode();
        if (buffer.trim()) emit(buffer);
        controller.close();
      } catch (error) {
        try {
          await reader.cancel();
        } catch {
          // The upstream may already be closed.
        }
        try {
          controller.enqueue(
            encoder.encode(encodeSse({ error: toErrorMessage(error) })),
          );
        } catch {
          // The client may already have cancelled.
        }
        try {
          controller.close();
        } catch {
          // The stream may already be closed.
        }
      } finally {
        reader?.releaseLock();
      }
    },

    cancel(reason) {
      return reader?.cancel(reason);
    },
  });
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
      body = (await response.json()) as unknown;
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }

    const models = adapter
      .parseDiscoveryResponse(body)
      .filter((name) => name.length > 0);
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
