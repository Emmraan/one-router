'use client';

import * as React from 'react';
import { MathRenderer, MermaidRenderer } from './markdown-math';
import { CodeBlock } from './markdown-code-block';
import { safeLinkHref } from '../lib/markdown';

interface MarkdownRendererProps {
  content: string;
  onTextSelect?: (text: string, position: { x: number; y: number } | null) => void;
  isStreaming?: boolean;
}

export function MarkdownRenderer({ content, onTextSelect, isStreaming }: MarkdownRendererProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const autoCloseMarkdown = (raw: string) => {
    if (!raw) return '';
    let closed = raw;

    const tripleBacktickCount = (closed.match(/```/g) || []).length;
    if (tripleBacktickCount % 2 !== 0) closed += '\n```';

    const cleanForSingle = closed.replace(/```/g, '');
    const singleBacktickCount = (cleanForSingle.match(/`/g) || []).length;
    if (singleBacktickCount % 2 !== 0) closed += '`';

    const boldCount = (closed.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) closed += '**';

    const cleanForItalic = closed.replace(/\*\*/g, '');
    const italicCount = (cleanForItalic.match(/\*/g) || []).length;
    if (italicCount % 2 !== 0) closed += '*';

    return closed;
  };

  const handleSelection = () => {
    if (!onTextSelect) return;
    const selection = window.getSelection();
    if (!selection) return;

    const selectedText = selection.toString().trim();
    if (selectedText.length > 0) {
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length > 0) {
        const rect = rects[0];
        const containerRect = containerRef.current?.getBoundingClientRect();
        const containerLeft = containerRect?.left || 0;
        const containerTop = containerRect?.top || 0;
        onTextSelect(selectedText, {
          x: rect.left - containerLeft + rect.width / 2,
          y: rect.top - containerTop - 36,
        });
      }
    } else {
      onTextSelect('', null);
    }
  };

  const formatInlineText = (text: string) => {
    if (!text) return '';
    let clean = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    clean = clean.replace(/__(.*?)__/g, '<strong>$1</strong>');
    clean = clean.replace(/\*(.*?)\*/g, '<em>$1</em>');
    clean = clean.replace(/_(.*?)_/g, '<em>$1</em>');
    clean = clean.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[12px] text-rose-600 dark:text-rose-450">$1</code>');
    clean = clean.replace(/\[(.*?)\]\((.*?)\)/g, (_match, label: string, url: string) => `<a href="${safeLinkHref(url)}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-emerald-400 hover:underline font-bold">${label}</a>`);

    return <span dangerouslySetInnerHTML={{ __html: clean }} className="select-text" />;
  };

  const renderInlineMarkup = (text: string) => {
    if (!text) return '';
    const parts = text.split(/(\$[^\$]+\$)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        return <MathRenderer key={pIdx} math={part.slice(1, -1)} block={false} />;
      }
      return formatInlineText(part);
    });
  };

  const parseMarkdown = (raw: string) => {
    if (!raw) return [];
    const blocks: any[] = [];
    const lines = raw.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim().startsWith('$$')) {
        const mathLines: string[] = [];
        let firstContent = line.replace(/^\$\$/, '');
        if (firstContent.trim()) mathLines.push(firstContent);
        i++;
        while (i < lines.length && !lines[i].trim().includes('$$')) {
          mathLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().includes('$$')) {
          const lastContent = lines[i].replace(/\$\$/, '');
          if (lastContent.trim()) mathLines.push(lastContent);
          i++;
        }
        blocks.push({ type: 'math-block', content: mathLines.join('\n').trim() });
        continue;
      }

      if (line.trim().startsWith('```')) {
        const lang = line.trim().slice(3).trim() || 'code';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        blocks.push({ type: 'code', lang, content: codeLines.join('\n') });
        i++;
        continue;
      }

      if (line.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('>')) {
          quoteLines.push(lines[i].substring(1).trim());
          i++;
        }
        blocks.push({ type: 'quote', content: quoteLines.join('\n') });
        continue;
      }

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const listItems: string[] = [];
        while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
          listItems.push(lines[i].trim().substring(2));
          i++;
        }
        blocks.push({ type: 'ul', items: listItems });
        continue;
      }

      if (/^\d+\.\s+/.test(line.trim())) {
        const listItems: string[] = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          const match = lines[i].trim().match(/^\d+\.\s+(.*)/);
          if (match) listItems.push(match[1]);
          i++;
        }
        blocks.push({ type: 'ol', items: listItems });
        continue;
      }

      if (line.trim().startsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const headers = tableLines[0].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map((h) => h.trim());
          const rows = tableLines.slice(2).map((rLine) => rLine.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map((cell) => cell.trim()));
          blocks.push({ type: 'table', headers, rows });
          continue;
        }
      }

      if (line.startsWith('#')) {
        const headerLevel = line.match(/^#+/)?.[0].length || 1;
        const text = line.replace(/^#+\s*/, '');
        if (headerLevel <= 6) {
          blocks.push({ type: 'heading', level: headerLevel, content: text });
          i++;
          continue;
        }
      }

      if (line.trim()) {
        const pLines: string[] = [];
        while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !lines[i].startsWith('>') && !lines[i].trim().startsWith('- ') && !lines[i].trim().startsWith('* ') && !/^\d+\.\s+/.test(lines[i].trim())) {
          pLines.push(lines[i]);
          i++;
        }
        blocks.push({ type: 'p', content: pLines.join('  \n') });
        continue;
      }

      i++;
    }

    return blocks;
  };

  const finalizedContent = isStreaming ? autoCloseMarkdown(content) : content;
  const parsedBlocks = parseMarkdown(finalizedContent);

  return (
    <div
      ref={containerRef}
      onMouseUp={handleSelection}
      className="space-y-4 text-[14.5px] leading-relaxed text-zinc-800 dark:text-zinc-200 select-text"
    >
      {parsedBlocks.map((block, index) => {
        const isLastBlock = index === parsedBlocks.length - 1;

        switch (block.type) {
          case 'heading': {
            const hClass = [
              '',
              'text-2xl font-bold tracking-tight text-zinc-950 dark:text-white pt-2 first:pt-0',
              'text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 pt-1.5 first:pt-0',
              'text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-200 pt-1 first:pt-0',
              'text-base font-semibold text-zinc-800 dark:text-zinc-300',
              'text-sm font-semibold text-zinc-800 dark:text-zinc-300',
              'text-xs font-semibold uppercase text-zinc-500 tracking-wider',
            ][block.level] || 'text-base font-bold';
            const Tag = `h${block.level}` as any;
            return (
              <Tag key={index} className={hClass}>
                {renderInlineMarkup(block.content)}
                {isStreaming && isLastBlock && <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />}
              </Tag>
            );
          }

          case 'p':
            return (
              <p key={index} className="whitespace-pre-line">
                {renderInlineMarkup(block.content)}
                {isStreaming && isLastBlock && <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />}
              </p>
            );

          case 'quote':
            return (
              <blockquote key={index} className="pl-4 border-l-3 border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 italic bg-zinc-50/50 dark:bg-zinc-950/20 py-1.5 pr-2.5 rounded-r-lg">
                {block.content.split('\n').map((line: string, qIdx: number, qLines: string[]) => (
                  <p key={qIdx}>
                    {renderInlineMarkup(line)}
                    {isStreaming && isLastBlock && qIdx === qLines.length - 1 && <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />}
                  </p>
                ))}
              </blockquote>
            );

          case 'ul':
            return (
              <ul key={index} className="list-disc pl-5.5 space-y-1 my-2">
                {block.items.map((item: string, uIdx: number) => (
                  <li key={uIdx} className="select-text">
                    {renderInlineMarkup(item)}
                    {isStreaming && isLastBlock && uIdx === block.items.length - 1 && <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />}
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={index} className="list-decimal pl-5.5 space-y-1 my-2">
                {block.items.map((item: string, oIdx: number) => (
                  <li key={oIdx} className="select-text">
                    {renderInlineMarkup(item)}
                    {isStreaming && isLastBlock && oIdx === block.items.length - 1 && <span className="inline-block w-1.5 h-3.5 ml-1 bg-emerald-500 align-middle rounded-xs animate-pulse" />}
                  </li>
                ))}
              </ol>
            );

          case 'math-block':
            return <MathRenderer key={index} math={block.content} block={true} />;

          case 'table':
            return (
              <div key={index} className="overflow-x-auto border border-zinc-200 dark:border-zinc-805 rounded-xl my-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider font-mono">
                      {block.headers.map((h: string, hIdx: number) => (
                        <th key={hIdx} className="px-4 py-2.5 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row: string[], rIdx: number) => (
                      <tr key={rIdx} className="border-b last:border-b-0 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/30">
                        {row.map((cell: string, cIdx: number) => (
                          <td key={cIdx} className="px-4 py-2 font-mono text-[12.5px] whitespace-nowrap select-text">{renderInlineMarkup(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'code':
            if (block.lang.toLowerCase() === 'mermaid') {
              return <MermaidRenderer key={index} code={block.content} />;
            }
            return <CodeBlock key={index} lang={block.lang} content={block.content} index={index} isStreaming={isStreaming} isLastBlock={isLastBlock} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
