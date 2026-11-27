'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { parseMarkdown } from '../lib/parse-markdown';
import { parseInline } from '../lib/parse-inline';

const CodeBlock = dynamic(() => import('./markdown-code-block').then((module) => module.CodeBlock));
const MathRenderer = dynamic(() => import('./markdown-math').then((module) => module.MathRenderer));
const MermaidRenderer = dynamic(() => import('./markdown-diagram').then((module) => module.MermaidRenderer), {
  loading: () => <p role="status" className="muted">Drawing diagram…</p>, ssr: false,
});

function renderInline(text: string, budget: { parts: number; math: number }) {
  return parseInline(text, Math.max(0, budget.parts)).map((part, index) => {
    budget.parts--;
    if (part.type === 'code') return <code key={index}>{part.content}</code>;
    if (part.type === 'strong') return <strong key={index}>{part.content}</strong>;
    if (part.type === 'em') return <em key={index}>{part.content}</em>;
    if (part.type === 'math') return budget.math-- > 0 ? <MathRenderer key={index} math={part.content} /> : <React.Fragment key={index}>${part.content}$</React.Fragment>;
    if (part.type === 'link') return <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">{part.content}</a>;
    return <React.Fragment key={index}>{part.content}</React.Fragment>;
  });
}

export function MarkdownRenderer({ content, onTextSelect, isStreaming }: {
  content: string; isStreaming?: boolean;
  onTextSelect?: (text: string, position: { x: number; y: number } | null) => void;
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const blocks = React.useMemo(() => parseMarkdown(content), [content]);
  const budget = { parts: 1000, math: 20 };
  const select = () => {
    if (!onTextSelect) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.toString().trim()) return onTextSelect('', null);
    const bounds = selection.getRangeAt(0).getBoundingClientRect();
    const parent = container.current?.getBoundingClientRect();
    onTextSelect(selection.toString().trim(), { x: bounds.left - (parent?.left ?? 0) + bounds.width / 2, y: bounds.top - (parent?.top ?? 0) - 36 });
  };
  return <div ref={container} className="markdown-content" onMouseUp={select}>
    {blocks.map((block, index) => {
      const inline = 'content' in block && ['heading', 'paragraph', 'quote'].includes(block.type) ? renderInline(block.content, budget) : null;
      switch (block.type) {
        case 'heading': {
          const Heading = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
          return <Heading key={index}>{inline}</Heading>;
        }
        case 'paragraph': return <p key={index}>{inline}</p>;
        case 'quote': return <blockquote key={index}>{inline}</blockquote>;
        case 'notice': return <p key={index} className="status-notice">{block.content}</p>;
        case 'math': return <MathRenderer key={index} math={block.content} block />;
        case 'code': return block.language.toLowerCase() === 'mermaid'
          ? <MermaidRenderer key={index} code={block.content} />
          : <CodeBlock key={index} lang={block.language} content={block.content} index={index} isStreaming={isStreaming} />;
        case 'list': {
          const List = block.ordered ? 'ol' : 'ul';
          return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, budget)}</li>)}</List>;
        }
        case 'table': return <div key={index} className="markdown-table"><table><thead><tr>{block.headers.map((header, j) => <th key={j}>{renderInline(header, budget)}</th>)}</tr></thead><tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>{renderInline(cell, budget)}</td>)}</tr>)}</tbody></table></div>;
      }
    })}
    {isStreaming && <span className="streaming-caret" aria-label="Generating response" />}
  </div>;
}
