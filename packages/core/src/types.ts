export const PROVIDER_TYPES = ['openai', 'anthropic', 'gemini', 'ollama'] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  base64?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  model?: string;
  isRegenerated?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  providerId: string;
  model: string;
  messages: Message[];
  isTemporary?: boolean;
  isPinned?: boolean;
  committed?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  customHeaders?: Record<string, string> | string;
  isActive: boolean;
}

export interface ProviderDefaults {
  name: string;
  baseUrl: string;
  models: string[];
}

export const PROVIDER_DEFAULTS: Record<ProviderType, ProviderDefaults> = {
  openai: {
    name: 'OpenAI Compatible',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o3-mini'],
  },
  anthropic: {
    name: 'Anthropic Compatible',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest',
    ],
  },
  gemini: {
    name: 'Gemini (Direct AI Studio)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
    ],
  },
  ollama: {
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    models: ['llama3', 'mistral', 'gemma', 'phi3'],
  },
};

export interface ModelAlias {
  alias: string;
  target: string;
}

export interface ChatRequest {
  providerType: ProviderType;
  model: string;
  messages: Message[];
  baseUrl?: string;
  apiKey?: string;
  customHeaders?: Record<string, string> | string;
}

export interface DiscoveryRequest {
  providerType: ProviderType;
  baseUrl?: string;
  apiKey?: string;
}

export type DiscoveryResult =
  | { success: true; models: string[] }
  | { success: false; error: string };

export interface ProviderHttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
}

export type StreamLineParser = (line: string) => string | null;

export interface ProviderAdapter {
  readonly type: ProviderType;
  buildChatRequest(input: ChatRequest): ProviderHttpRequest;
  buildDiscoveryRequests(input: DiscoveryRequest): ProviderHttpRequest[];
  parseDiscoveryResponse(body: unknown): string[];
  createStreamParser(): StreamLineParser;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface ChatDeps {
  fetch?: FetchLike;
  signal?: AbortSignal;
}

export interface AttachmentLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}
