export type InlinePart = { type: 'text' | 'code' | 'strong' | 'em' | 'math' | 'link'; content: string; href?: string };

export function parseInline(text: string, limit = 1000): InlinePart[] {
  // Stop unfinished links at the next opener so malformed input stays linear.
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|\[[^[\]\n]+\]\([^\s()]+\)|\$[^$\n]+\$)/g;
  const parts: InlinePart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (parts.length + 2 > limit) break;
    if (match.index > cursor) parts.push({ type: 'text', content: text.slice(cursor, match.index) });
    const token = match[0];
    if (token.startsWith('`')) parts.push({ type: 'code', content: token.slice(1, -1) });
    else if (token.startsWith('**')) parts.push({ type: 'strong', content: token.slice(2, -2) });
    else if (token.startsWith('*') || token.startsWith('_')) parts.push({ type: 'em', content: token.slice(1, -1) });
    else if (token.startsWith('$')) parts.push({ type: 'math', content: token.slice(1, -1) });
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      parts.push({ type: 'link', content: link[1], href: /^(https?:\/\/|mailto:)/i.test(link[2]) ? link[2] : '#' });
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) parts.push({ type: 'text', content: text.slice(cursor) });
  return parts;
}
