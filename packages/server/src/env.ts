import { homedir } from 'node:os';
import { join } from 'node:path';

export type FileStorageKind = 'sqlite' | 'filesystem' | 's3';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export interface ServerEnv {
  production: boolean;
  databaseUrl: string;
  databaseAuthToken?: string;
  encryptionKey?: string;
  allowLocalKeyCreation?: boolean;
  dataDir: string;
  initialPassword?: string;
  authToken?: string;
  allowedOrigins: string[];
  sessionDays: number;
  trustProxy: boolean;
  maxFileMb: number;
  maxFiles: number;
  maxTotalMb: number;
  port: number;
  version: string;
  providerKeys: { openai?: string; anthropic?: string; gemini?: string };
  ollamaBaseUrl?: string;
  s3?: S3Config;
  storage: FileStorageKind;
}

const MEBIBYTE = 1024 * 1024;

function integer(value: string | undefined, fallback: number, name: string, min: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function decimal(value: string | undefined, fallback: number, name: string, min: number, max: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return parsed;
}

function origin(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('ONE_ROUTER_ALLOWED_ORIGINS contains an invalid origin');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash) {
    throw new Error('ONE_ROUTER_ALLOWED_ORIGINS must contain plain http or https origins');
  }
  return url.origin;
}

function origins(value: string | undefined, production: boolean): string[] {
  if (value === undefined || value.trim() === '') {
    return production ? [] : ['http://localhost:3000', 'http://localhost:4000'];
  }
  return [...new Set(value.split(',').map(origin))].slice(0, 32);
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function s3Config(source: Record<string, string | undefined>): S3Config | undefined {
  const bucket = optional(source.S3_BUCKET);
  const accessKeyId = optional(source.S3_ACCESS_KEY_ID);
  const secretAccessKey = optional(source.S3_SECRET_ACCESS_KEY);
  if ((!bucket && !accessKeyId && !secretAccessKey) ||
    (isVercel(source) && (!bucket || !accessKeyId || !secretAccessKey))) return undefined;
  const region = optional(source.S3_REGION) ?? 'us-east-1';
  const endpoint = optional(source.S3_ENDPOINT) ?? `https://s3.${region}.amazonaws.com`;
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{1,61}[A-Za-z0-9]$/.test(bucket ?? '') ||
    !accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('S3_ENDPOINT must be an http or https URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('S3_ENDPOINT must be a plain http or https URL');
  }
  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    region,
    bucket: bucket!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    forcePathStyle: ['1', 'true', 'yes'].includes((source.S3_FORCE_PATH_STYLE ?? '').toLowerCase()),
  };
}

function isVercel(source: Record<string, string | undefined>): boolean {
  return source.VERCEL === '1' || source.VERCEL === 'true';
}

export function loadEnv(
  source: Record<string, string | undefined> = process.env,
  options: { localDatabase?: boolean } = {},
): ServerEnv {
  const production = source.NODE_ENV === 'production';
  const vercel = isVercel(source);
  const dataDir = optional(source.ONE_ROUTER_DATA_DIR) ?? join(homedir(), '.one-router');
  const externalDatabaseUrl = optional(source.TURSO_DATABASE_URL);
  const databaseUrl = externalDatabaseUrl ?? (!production || options.localDatabase
    ? `file:${join(dataDir, 'one-router.db').replaceAll('\\', '/')}` : undefined);
  if (!databaseUrl) throw new Error('TURSO_DATABASE_URL is required in production');

  const initialPassword = optional(source.INITIAL_PASSWORD);
  if (initialPassword !== undefined && [...initialPassword].length < 12) {
    throw new Error('INITIAL_PASSWORD must contain at least 12 characters');
  }
  const authToken = optional(source.ONE_ROUTER_AUTH_TOKEN);
  if (authToken !== undefined && authToken.length < 16) {
    throw new Error('ONE_ROUTER_AUTH_TOKEN must contain at least 16 characters');
  }
  const s3 = s3Config(source);
  const trustProxy = optional(source.ONE_ROUTER_TRUST_PROXY)?.toLowerCase() ?? 'false';
  if (!['true', 'false'].includes(trustProxy)) throw new Error('ONE_ROUTER_TRUST_PROXY must be true or false');
  const uploadLimit = vercel ? 4 : Infinity;

  return {
    production,
    databaseUrl,
    databaseAuthToken: optional(source.TURSO_AUTH_TOKEN),
    encryptionKey: optional(source.ONE_ROUTER_ENCRYPTION_KEY),
    allowLocalKeyCreation: options.localDatabase && !externalDatabaseUrl,
    dataDir,
    initialPassword,
    authToken,
    allowedOrigins: origins(source.ONE_ROUTER_ALLOWED_ORIGINS, production),
    sessionDays: integer(source.ONE_ROUTER_SESSION_DAYS, 30, 'ONE_ROUTER_SESSION_DAYS', 1, 365),
    trustProxy: trustProxy === 'true',
    // Leave room for multipart headers within Vercel's function payload limit.
    maxFileMb: Math.min(decimal(source.ONE_ROUTER_MAX_FILE_MB, 10, 'ONE_ROUTER_MAX_FILE_MB', 1, 10), uploadLimit),
    maxFiles: integer(source.ONE_ROUTER_MAX_FILES, 10, 'ONE_ROUTER_MAX_FILES', 1, 100),
    maxTotalMb: Math.min(decimal(source.ONE_ROUTER_MAX_TOTAL_MB, 20, 'ONE_ROUTER_MAX_TOTAL_MB', 1, 100), uploadLimit),
    port: integer(source.PORT, 4000, 'PORT', 1, 65535),
    version: optional(source.ONE_ROUTER_VERSION) ?? '0.1.0',
    providerKeys: {
      openai: optional(source.OPENAI_API_KEY),
      anthropic: optional(source.ANTHROPIC_API_KEY),
      gemini: optional(source.GEMINI_API_KEY),
    },
    ollamaBaseUrl: optional(source.OLLAMA_BASE_URL),
    s3,
    storage: vercel || s3 ? 's3' : production ? 'filesystem' : 'sqlite',
  };
}

export function loadVercelEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const databaseUrl = optional(source.TURSO_DATABASE_URL)?.replace(/^libsql:\/\//i, 'https://');
  const url = databaseUrl && URL.canParse(databaseUrl) ? new URL(databaseUrl) : undefined;
  if (url?.protocol !== 'https:' || url.username || url.password) {
    throw new Error('TURSO_DATABASE_URL must be a remote TLS database URL on Vercel');
  }
  if (!optional(source.TURSO_AUTH_TOKEN)) throw new Error('TURSO_AUTH_TOKEN is required on Vercel');
  if (!optional(source.ONE_ROUTER_ENCRYPTION_KEY)) throw new Error('ONE_ROUTER_ENCRYPTION_KEY is required on Vercel');
  return loadEnv({ ...source, TURSO_DATABASE_URL: databaseUrl, NODE_ENV: 'production', VERCEL: '1' });
}

export function maxUploadBytes(env: ServerEnv): number {
  // The attachment table caps a single file at 10 MiB even when configuration allows more.
  return Math.min(Math.floor(env.maxFileMb * MEBIBYTE), 10 * MEBIBYTE);
}
