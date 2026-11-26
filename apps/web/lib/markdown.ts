const SAFE_SCHEME = /^(https?:\/\/|mailto:)/i;

// Markdown is rendered from assistant output, which is untrusted. Only allow
// navigable schemes and escape attribute quotes so a crafted URL cannot break
// out of the href.
export function safeLinkHref(raw: string): string {
  const url = raw.trim();
  if (!SAFE_SCHEME.test(url)) return '#';
  return url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
