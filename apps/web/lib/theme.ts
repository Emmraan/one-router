export type Theme = 'light' | 'dark' | 'system';

export const THEME_COOKIE = 'one_router_theme';
export const DEFAULT_THEME: Theme = 'dark';

export function normalizeTheme(value: unknown): Theme {
  return value === 'light' || value === 'system' ? value : 'dark';
}

export function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
  return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
}

export function applyTheme(theme: Theme, root?: { classList: { toggle(token: string, force: boolean): void } }): void {
  const target = root ?? (typeof document !== 'undefined' ? document.documentElement : undefined);
  if (!target) return;
  const prefersDark = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  target.classList.toggle('dark', resolveTheme(theme, prefersDark) === 'dark');
}

// Reads the first-frame theme cookie. Takes the cookie string so it stays a
// pure function and testable without a DOM.
export function readThemeCookie(cookie: string): Theme | null {
  const match = /(?:^|;)\s*one_router_theme=(light|dark|system)(?:;|$)/.exec(cookie);
  return match ? (match[1] as Theme) : null;
}

export function writeThemeCookie(theme: Theme, maxAgeSeconds = 60 * 60 * 24 * 365): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}
