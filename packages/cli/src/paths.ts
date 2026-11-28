import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const homeDataDir = join(homedir(), '.one-router');
export const configPath = () => resolve(process.env.ONE_ROUTER_CONFIG?.trim() || join(homeDataDir, 'config.json'));
export const webDir = fileURLToPath(new URL('./web/', import.meta.url));
