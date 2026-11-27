export const rendererLimit = 100_000;
export type MarkdownBlock =
  | { type: 'paragraph' | 'quote' | 'math' | 'notice'; content: string }
  | { type: 'heading'; content: string; level: number }
  | { type: 'code'; content: string; language: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
const isBoundary = (line: string) => /^(#{1,6}\s|```|>|[-*]\s|\d+\.\s|\$\$|\|)/.test(line.trim());

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.slice(0, rendererLimit).split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  let remaining = 1000;
  let richBlocks = 20;
  let limited = false;
  while (i < lines.length && remaining > 0) {
    const line = lines[i++].trim();
    if (!line) continue;
    if (line.startsWith('```') || line.startsWith('$$')) {
      if (richBlocks-- === 0) { limited = true; break; }
    }
    if (line.startsWith('```')) {
      const content: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) content.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push({ type: 'code', language: line.slice(3).trim().slice(0, 40) || 'text', content: content.join('\n') });
    } else if (line.startsWith('$$')) {
      let content = line.slice(2);
      if (!content.endsWith('$$')) {
        while (i < lines.length) {
          const next = lines[i++];
          content += '\n' + next;
          if (next.trim().endsWith('$$')) break;
        }
      }
      blocks.push({ type: 'math', content: content.replace(/\$\$$/, '').trim() });
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push({ type: 'heading', level: line.match(/^#+/)![0].length, content: line.replace(/^#+\s+/, '') });
    } else if (/^>/.test(line)) {
      const content = [line.replace(/^>\s?/, '')];
      while (i < lines.length && /^>/.test(lines[i])) content.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', content: content.join('\n') });
    } else if (/^([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\d/.test(line);
      const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      const items = [line.replace(pattern, '')];
      while (i < lines.length && items.length < remaining && pattern.test(lines[i].trim())) items.push(lines[i++].trim().replace(pattern, ''));
      blocks.push({ type: 'list', ordered, items });
    } else if (line.startsWith('|') && i < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i]) && lines[i].includes('---')) {
      i++;
      const fullHeaders = cells(line);
      const headers = fullHeaders.slice(0, Math.min(40, remaining));
      limited ||= headers.length < fullHeaders.length;
      const rows: string[][] = [];
      let available = remaining - headers.length;
      while (i < lines.length && available > 0 && lines[i].trim().startsWith('|')) {
        const fullRow = cells(lines[i++]);
        const row = fullRow.slice(0, Math.min(headers.length, available));
        limited ||= row.length < fullRow.length;
        rows.push(row);
        available -= row.length;
      }
      blocks.push({ type: 'table', headers, rows });
    } else {
      const content = [line];
      while (i < lines.length && lines[i].trim() && !isBoundary(lines[i])) content.push(lines[i++]);
      blocks.push({ type: 'paragraph', content: content.join('\n') });
    }
    const block = blocks[blocks.length - 1];
    remaining -= block.type === 'list' ? block.items.length : block.type === 'table' ? block.headers.length + block.rows.reduce((sum, row) => sum + row.length, 0) : 1;
  }
  if (source.length > rendererLimit || i < lines.length || limited) {
    blocks.push({ type: 'notice', content: source.length > rendererLimit
      ? 'Preview limited to 100,000 characters. Copy or export for the full response.'
      : 'Preview limited to keep this response responsive. Copy or export for the full response.' });
  }
  return blocks;
}
