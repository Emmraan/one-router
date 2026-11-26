import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { ServerEnv } from '../env';

export const SESSION_COOKIE = 'one_router_session';

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function setSessionCookie(c: Context, token: string, env: ServerEnv, ttlMs: number): void {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.production,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.max(1, Math.floor(ttlMs / 1000)),
  });
}

export function clearSessionCookie(c: Context, env: ServerEnv): void {
  deleteCookie(c, SESSION_COOKIE, { secure: env.production, sameSite: 'Lax', path: '/' });
}
