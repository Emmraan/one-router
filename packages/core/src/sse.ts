export interface SseEvent {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

export interface SseParserOptions {
  maxBufferBytes?: number;
}

const DEFAULT_MAX_BUFFER_BYTES = 1024 * 1024;

export class SseParser {
  private buffer = '';
  private dataLines: string[] = [];
  private eventName: string | undefined;
  private lastId: string | undefined;
  private retry: number | undefined;
  private readonly maxBufferBytes: number;

  constructor(options: SseParserOptions = {}) {
    this.maxBufferBytes = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
  }

  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];

    let lineEnd: number;
    while ((lineEnd = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, lineEnd);
      this.buffer = this.buffer.slice(lineEnd + 1);
      if (line.length > this.maxBufferBytes) {
        throw new Error(`SSE line exceeded ${this.maxBufferBytes} bytes`);
      }
      this.processLine(line.endsWith('\r') ? line.slice(0, -1) : line, events);
    }

    if (this.buffer.length > this.maxBufferBytes) {
      throw new Error(`SSE buffer exceeded ${this.maxBufferBytes} bytes`);
    }

    return events;
  }

  flush(): SseEvent[] {
    const events: SseEvent[] = [];
    if (this.buffer) {
      const line = this.buffer;
      this.buffer = '';
      this.processLine(line.endsWith('\r') ? line.slice(0, -1) : line, events);
    }
    this.dispatch(events);
    return events;
  }

  private processLine(line: string, events: SseEvent[]): void {
    if (line === '') {
      this.dispatch(events);
      return;
    }
    if (line.startsWith(':')) return;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    switch (field) {
      case 'data':
        this.dataLines.push(value);
        break;
      case 'event':
        this.eventName = value;
        break;
      case 'id':
        if (!value.includes('\0')) this.lastId = value;
        break;
      case 'retry':
        if (/^\d+$/.test(value)) this.retry = Number(value);
        break;
      default:
        break;
    }
  }

  private dispatch(events: SseEvent[]): void {
    if (this.dataLines.length === 0) {
      this.eventName = undefined;
      this.retry = undefined;
      return;
    }

    const event: SseEvent = { data: this.dataLines.join('\n') };
    if (this.eventName !== undefined) event.event = this.eventName;
    if (this.lastId !== undefined) event.id = this.lastId;
    if (this.retry !== undefined) event.retry = this.retry;
    events.push(event);

    this.dataLines = [];
    this.eventName = undefined;
    this.retry = undefined;
  }
}

export function encodeSse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
