import type { FetchLike } from '@one-router/core';
import type { Database } from '@one-router/db';
import type { ServerEnv } from './env';
import type { FileStore } from './files/storage';

export interface LogEntry {
  level: 'info' | 'error';
  message: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  code?: string;
}

export type Logger = (entry: LogEntry) => void;

export interface AuthContext {
  kind: 'session' | 'bearer';
  userId: string;
  mustChangePassword: boolean;
  sessionToken?: string;
}

export type AppVariables = {
  requestId: string;
  logger: Logger;
  auth: AuthContext | null;
  ownerId: string;
};

export type AppEnv = { Variables: AppVariables };

export interface AppOptions {
  db: Database;
  env: ServerEnv;
  fetch?: FetchLike;
  logger?: Logger;
  now?: () => number;
  fileStore?: FileStore;
}
