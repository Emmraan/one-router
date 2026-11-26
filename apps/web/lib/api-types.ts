import type { ProviderType } from './provider-types';

export interface AuthUser {
  id: string;
  role: string;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: number | null;
  createdAt: number;
  updatedAt: number;
  profile: Record<string, unknown> | null;
}

export interface AuthStatus {
  authenticated: boolean;
  mustChangePassword: boolean;
  user?: AuthUser;
}

export interface ChatDto {
  id: string;
  providerId: string | null;
  model: string;
  title: string;
  manualTitle: boolean;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface MessageDto {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string | null;
  position: number;
  isRegenerated: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderDto {
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

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface DiscoveryResult {
  success: boolean;
  models?: string[];
  error?: string;
}

export interface ErrorBody {
  error: string;
  code: string;
  requestId?: string;
  details?: string[];
}
