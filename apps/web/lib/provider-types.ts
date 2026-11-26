export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'ollama';

// Public provider shape returned by the server. The API key never leaves the
// server; presence is signalled by `hasApiKey`.
export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  models: string[];
  isActive: boolean;
  hasApiKey: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  status?: 'uploading' | 'ready' | 'error';
  progress?: number;
  error?: string;
  clientId?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
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
  providerId: string | null;
  model: string;
  messages: Message[];
  isPinned?: boolean;
  manualTitle?: boolean;
}

export interface ProviderDefaults {
  name: string;
  baseUrl: string;
  models: string[];
}

export const PROVIDER_DEFAULTS: Record<ProviderType, ProviderDefaults> = {
  openai: {
    name: 'OpenAI Direct',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini'],
  },
  anthropic: {
    name: 'Anthropic Direct',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  },
  gemini: {
    name: 'Gemini AI Studio',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash'],
  },
  ollama: {
    name: 'Ollama local',
    baseUrl: 'http://localhost:11434',
    models: ['llama3', 'mistral', 'gemma'],
  },
};
