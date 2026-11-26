export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey?: string; // Stored encrypted
  models: string[];
  customHeaders?: string;
  isActive: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string; // for UI display blob
  base64?: string; // base64 representation of file
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
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
  providerId: string; // Active provider when chatting
  model: string;      // Active model when chatting
  messages: Message[];
  isTemporary?: boolean;
  isPinned?: boolean;
  committed?: boolean;
}

export const PROVIDER_DEFAULTS: Record<ProviderType, { name: string; baseUrl: string; models: string[] }> = {
  openai: {
    name: 'OpenAI Compatible',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o3-mini'],
  },
  anthropic: {
    name: 'Anthropic Compatible',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
  },
  gemini: {
    name: 'Gemini (Direct AI Studio)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-exp', 'gemini-1.5-flash'],
  },
  ollama: {
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    models: ['llama3', 'mistral', 'gemma', 'phi3'],
  },
};
