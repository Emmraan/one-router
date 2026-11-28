import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from '@one-router/server';
import { CliError, validateHost } from './arguments';
import { configPath, homeDataDir } from './paths';

const PUBLIC_SETTINGS = [
  'ONE_ROUTER_HOST', 'PORT', 'ONE_ROUTER_DATA_DIR', 'ONE_ROUTER_ALLOWED_ORIGINS',
  'ONE_ROUTER_SESSION_DAYS', 'ONE_ROUTER_TRUST_PROXY', 'ONE_ROUTER_MAX_FILE_MB', 'ONE_ROUTER_MAX_FILES', 'ONE_ROUTER_MAX_TOTAL_MB',
  'S3_BUCKET', 'S3_REGION', 'S3_FORCE_PATH_STYLE',
];
const PRIVATE_SETTINGS = new Set([
  'INITIAL_PASSWORD', 'ONE_ROUTER_AUTH_TOKEN', 'ONE_ROUTER_ENCRYPTION_KEY', 'TURSO_AUTH_TOKEN',
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
  'TURSO_DATABASE_URL', 'OLLAMA_BASE_URL', 'S3_ENDPOINT',
]);
const KEYS = new Set([...PUBLIC_SETTINGS, ...PRIVATE_SETTINGS]);
const ENV_REFERENCE = /\$\{([A-Z_][A-Z0-9_]*)\}/gi;
export const defaults = { ONE_ROUTER_HOST: '127.0.0.1', PORT: '3000' };
type Settings = Record<string, string | undefined>;

export function parseSettings(text: string): Settings {
  try {
    const json: unknown = JSON.parse(text);
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error();
    return Object.fromEntries(Object.entries(json).map(([key, value]) => {
      if (!KEYS.has(key) || (typeof value !== 'string' && typeof value !== 'number' &&
        !(['S3_FORCE_PATH_STYLE', 'ONE_ROUTER_TRUST_PROXY'].includes(key) && typeof value === 'boolean'))) throw new Error();
      return [key, String(value)];
    }));
  } catch {
    throw new CliError('Invalid CLI configuration; use a JSON object with supported settings');
  }
}

export function mergeSettings(stored: Settings, env: Settings): Settings {
  return { ...stored, ...Object.fromEntries([...KEYS].filter((key) => env[key] !== undefined).map((key) => [key, env[key]])) };
}

export function printableSettings(settings: Settings): Settings {
  return Object.fromEntries(Object.entries(settings).map(([key, value]) => [key,
    PRIVATE_SETTINGS.has(key) || value?.match(ENV_REFERENCE) ? '[redacted]' : value]));
}

export async function readSettings(expandReferences = false): Promise<Settings> {
  let stored: Settings;
  try {
    stored = parseSettings(await readFile(configPath(), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') stored = {};
    else if (error instanceof CliError) throw error;
    else throw new CliError('Could not read the CLI configuration');
  }
  if (expandReferences) {
    stored = Object.fromEntries(Object.entries(stored).map(([key, value]) => [key,
      value?.replace(ENV_REFERENCE, (_reference, name: string) => process.env[name] ?? '')]));
  }
  return mergeSettings({ ...defaults, ...stored }, process.env);
}

export async function runtimeConfig(version: string, overrides: { port?: number; host?: string } = {}) {
  const settings = await readSettings(true);
  const host = validateHost(overrides.host ?? (settings.ONE_ROUTER_HOST?.trim() || defaults.ONE_ROUTER_HOST));
  try {
    const env = loadEnv({ ...settings, NODE_ENV: process.env.NODE_ENV, ONE_ROUTER_VERSION: version,
      ONE_ROUTER_DATA_DIR: resolve(settings.ONE_ROUTER_DATA_DIR?.trim() || homeDataDir),
      PORT: overrides.port?.toString() ?? (settings.PORT?.trim() || defaults.PORT),
    }, { localDatabase: true });
    if (!settings.ONE_ROUTER_ALLOWED_ORIGINS?.trim()) env.allowedOrigins = [];
    return { host, env };
  } catch (error) {
    throw new CliError(error instanceof Error ? error.message : 'Invalid server configuration');
  }
}
