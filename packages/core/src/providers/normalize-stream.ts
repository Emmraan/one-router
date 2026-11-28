import { CoreError, toErrorMessage } from '../errors';
import { encodeSse } from '../sse';
import type { StreamLineParser } from '../types';

export function normalizeStream(body: ReadableStream<Uint8Array>, parseLine: StreamLineParser): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const maxLineBytes = 1024 * 1024;
  const reader = body.getReader();
  let buffer = '';
  let upstreamDone = false;
  let ended = false;

  const stop = async (reason?: unknown) => {
    ended = true;
    try { await reader.cancel(reason); }
    finally { reader.releaseLock(); }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (!ended) {
          const lineEnd = buffer.indexOf('\n');
          if (lineEnd >= 0 || upstreamDone) {
            const line = lineEnd >= 0 ? buffer.slice(0, lineEnd) : buffer;
            buffer = lineEnd >= 0 ? buffer.slice(lineEnd + 1) : '';
            if (line.length > maxLineBytes) throw new CoreError('UPSTREAM_ERROR', 'Upstream stream line exceeded the 1 MiB limit', 502);
            const text = line.trim() ? parseLine(line.endsWith('\r') ? line.slice(0, -1) : line) : '';
            if (text) controller.enqueue(encoder.encode(encodeSse({ text })));
            if (upstreamDone && !buffer) {
              ended = true;
              reader.releaseLock();
              controller.close();
            }
            // One output per pull keeps an idle client from draining the provider.
            if (text || ended) return;
            continue;
          }
          if (buffer.length > maxLineBytes) throw new CoreError('UPSTREAM_ERROR', 'Upstream stream line exceeded the 1 MiB limit', 502);
          const { done, value } = await reader.read();
          if (ended) return;
          if (done) {
            upstreamDone = true;
            buffer += decoder.decode();
          } else buffer += decoder.decode(value, { stream: true });
        }
      } catch (error) {
        if (ended) return;
        try { await stop(); } catch { /* A broken upstream may reject cancellation. */ }
        controller.enqueue(encoder.encode(encodeSse({ error: toErrorMessage(error) })));
        controller.close();
      }
    },
    cancel: stop,
  });
}
