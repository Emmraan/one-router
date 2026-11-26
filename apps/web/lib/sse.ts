export interface StreamEvent {
  text?: string;
  error?: string;
}

// Parses one `data:` line from the normalized chat stream. `null` for
// comments, blank lines, and non-data frames so the reader can skip them.
export function parseSseLine(line: string): StreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as { text?: unknown; error?: unknown };
  const event: StreamEvent = {};
  if (typeof record.text === 'string') event.text = record.text;
  if (typeof record.error === 'string') event.error = record.error;
  return event;
}

// Buffers arbitrary network chunks and yields whole `data:` frames. Network
// chunks split SSE frames anywhere, so the trailing partial line is kept until
// the next push or flush.
export class SseDecoder {
  private buffer = '';

  push(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    const events: StreamEvent[] = [];
    for (const line of lines) {
      const event = parseSseLine(line);
      if (event) events.push(event);
    }
    return events;
  }

  flush(): StreamEvent[] {
    if (!this.buffer) return [];
    const event = parseSseLine(this.buffer);
    this.buffer = '';
    return event ? [event] : [];
  }
}
